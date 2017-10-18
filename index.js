'use strict';

var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var http = require('http');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var path = require('path');
require('./public/helpers');

if(process.env['NODE_ENV'] == 'production'){
	var ENV = process.env;
}else{
	var ENV = require('./env.json');
	ENV.PORT = 3000;
	process.env['NODE_ENV'] = 'development';
	console.log('Dev environment');
}

var httpServer = express();
var baseServer = http.createServer(httpServer);
var DealProperties = undefined;
var DealStages = undefined;

baseServer
	.listen(ENV.PORT, function(){
		console.log(Date().toLocaleString())
	});

httpServer
	.use(cookieParser())
	.use(bodyParser.json())
	.get('/authorize', function(req, res){
		res.redirect('https://app.hubspot.com/oauth/authorize?' + querystring.stringify({
			client_id: ENV['CLIENT_ID'],
			redirect_uri: ENV['REDIRECT_URI'],
			scope: 'contacts'
		}));
	})
	.get('/authorize/redirect', function(req, res){
		var requestToken = req.query.code;
		request({
			method: 'POST',
			url: 'https://api.hubapi.com/oauth/v1/token',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
			},
			form: {
				grant_type: 'authorization_code',
				client_id: ENV['CLIENT_ID'],
				client_secret: ENV['CLIENT_SECRET'],
				redirect_uri: ENV['REDIRECT_URI'],
				code: requestToken
			}
		}, function(error, response, body){
			if(error){
				res.clearCookie('access_token');
				res.redirect('/authorize');
			}else{
				res.cookie('access_token', JSON.parse(body)['access_token']);
				res.redirect('/');
			}
		});
	})
	.get('/authorize/reset', function(req, res){
		res.clearCookie('access_token');
		res.redirect('/authorize');
	})
	.get('*', function(req, res, next){
		if(process.env['NODE_ENV'] == 'development' || req.cookies['access_token']){
			next();
		}else{
			return res.redirect('/authorize');
		}
	})
	.get('/deals/properties', function(req, res, next){
		if(!req.query.refresh && DealProperties){
			return res.json(DealProperties);
		}
		HubAPIRequest(req, {
			method: 'GET',
			url: 'https://api.hubapi.com/properties/v1/deals/properties'
		}, function(result){
			if(result.statusCode == 401){
				return res.json(result);
			}
			DealProperties = {};
			var pIndex, property;
			for(pIndex = 0; pIndex < result.body.length; pIndex++){
				property = result.body[pIndex];
				DealProperties[property.name] = {
					name: property.name,
					label: property.label,
					type: property.type,
					fieldType: property.fieldType
				};
			}
			DealProperties['dealId'] = {
				name: 'dealId',
				label: 'Deal ID',
				type: 'number',
				fieldType: 'number'
			}
			next();
		});
	}, function(req, res){
		HubAPIRequest(req, {
			method: 'GET',
			url: 'https://api.hubapi.com/deals/v1/pipelines'
		}, function(result){
			if(result.statusCode == 401){
				if(req.query.refresh){
					return res.redirect('/authorize/reset');
				}else{
					return res.json(result);
				}
			}
			DealStages = {};
			result.body.forEach(function(pipeline){
				var stage;
				if(pipeline.pipelineId != 'default'){
					return;
				}
				for(var i = 0; i < pipeline.stages.length; i++){
					stage = pipeline.stages[i];
					DealStages[stage.stageId] = stage.label;
				}
			});
			res.json(DealProperties);
		})
	})
	.get('/deals/snapshot\.:format?', function(req, res){
		var Today = (new Date()).toArray();
		var snapshotDate = new Date(
			(parseInt(req.query.year) || Today[0]),
			(parseInt(req.query.month) || Today[1]),
			(parseInt(req.query.day) || Today[2])
		);
		var year = (parseInt(req.query.year) || Today[0]);

		var properties = (req.query.properties || '').trim();
		properties = (properties ? properties.split(',') : []);
		properties
			.addIfDoesNotInclude('createdate')
			.addIfDoesNotInclude('dealname');
		var offset = 0;
		var outputDeals = [];
		var numDealsTotal = 0;
		var numPages = 0;
		var numPerPage = 250;

		try{
			properties.forEach(function(propertyName){
				if(Object.keys(DealProperties).includes(propertyName) == false){
					throw propertyName;
				}
			});
		}catch(propertyName){
			return res.json({
				success: false,
				message: 'Property "' + propertyName + '" does not exist.'
			});
		}
		loadMoreDeals();

		function onComplete(){
			properties.unshift('dealId');
			if(req.params.format == 'tsv'){
				var output = [];
				var csvString;
				var dIndex, deal, pIndex, propertyName, propertyValue, propertyType;
				var delim = '\t';
				var filename = 'deals_snapshot_' + snapshotDate.toArray().join('-') + '.tsv';
				output.push(properties.join(delim));
				for(dIndex = 0; dIndex < outputDeals.length; dIndex += 1){
					deal = [];
					for(pIndex = 0; pIndex < properties.length; pIndex += 1){
						propertyName = properties[pIndex];
						propertyValue = outputDeals[dIndex][propertyName];
						propertyType = DealProperties[propertyName].type;
						if(propertyValue){
							if(propertyName == 'dealstage'){
								propertyValue = DealStages[propertyValue];
							}else if(propertyType == 'date' || propertyType == 'datetime'){
								propertyValue = (new Date(parseInt(propertyValue))).toArray().join('-');
							}else if(propertyType == 'string'){
								propertyValue = propertyValue.replace('\t', ' ');
							}
						}
						deal.push(propertyValue);
					}
					output.push(deal.join(delim));
				}
				csvString = output.join('\n');
				res.set('Content-Type', 'text/tab-separated-values');
				res.set('Content-Disposition', 'attachment; filename=' + filename);
				res.send(csvString);
			}else{
				res.json({
					snapshotDate: snapshotDate,
					properties: properties,
					numPages: numPages,
					numPerPage: numPerPage,
					numDealsTotal: numDealsTotal,
					deals: outputDeals,
					numDealsOutput: outputDeals.length
				});
			}
		}

		function loadMoreDeals(){
			HubAPIRequest(req, {
				method: 'GET',
				url: 'https://api.hubapi.com/deals/v1/deal/paged',
				qsStringifyOptions: {
					arrayFormat: 'repeat'
				},
				qs: {
					limit: numPerPage,
					offset: offset,
					properties: properties,
					propertiesWithHistory: true
				}
			}, function(apiResponse){
				if(!apiResponse.success){
					return res.redirect('/authorize/reset');
				}else{
					numPages += 1;
					numDealsTotal += apiResponse.body.deals.length;
					apiResponse.body.deals.forEach(appendDeal);
					if(apiResponse.body.hasMore && !(req.query.limitToFirst)){
						offset = apiResponse.body.offset;
						loadMoreDeals();
					}else{
						onComplete();
					}
				}
			});
		}

		function appendDeal(deal){
			var pIndex, propertyName, propertyType, versions, vIndex, version;
			var output = {};
			if(deal.properties.createdate.value > snapshotDate){
				return;
			}
			for(pIndex = 0; pIndex < properties.length; pIndex++){
				propertyName = properties[pIndex];
				propertyType = DealProperties[propertyName];

				if(!deal.properties[propertyName]){
					output[propertyName] = '';
				}else{
					versions = deal.properties[propertyName].versions;
					for(vIndex = 0; vIndex < versions.length; vIndex++){
						version = versions[vIndex];
						if(version.timestamp <= snapshotDate){
							output[propertyName] = version.value;
							break;
						}
					}
				}
			}
			output.dealId = deal.dealId;
			outputDeals.push(output);
		}
	})
	.use('/', express.static('./public'));

function HubAPIRequest(req, params, callback){
	if(process.env['NODE_ENV'] == 'development'){
		params.qs = (params.qs || {})
		params.qs['hapikey'] = ENV['HAPIKEY'];
	}else if(process.env['NODE_ENV'] == 'production'){
		params.headers = (params.headers || {});
		params.headers['Authorization'] = 'Bearer ' + req.cookies['access_token'];
	}
	console.log(params);
	request(params, function(error, response, body){
		var result = {
			success: true,
			statusCode: response.statusCode
		};
		console.log(response.statusCode);
		if(error || result.statusCode >= 400){
			result.success = false;
		}
		try{
			result.body = JSON.parse(body || '{}');
		}catch(e){
			result.body = (error || body);
		}
		callback(result);
	});
}
