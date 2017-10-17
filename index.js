'use strict';

var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var http = require('http');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var path = require('path');

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

Array.prototype.addIfDoesNotInclude = function(item){
	var array = this;
	if(array.indexOf(item) < 0){
		array.push(item);
	}
	return array;
}
Date.prototype.getMonthWithZeroes = function(){
	var date = this;
	return ('0' + (date.getMonth()+1)).slice(-2);
}
Date.prototype.getDateWithZeroes = function(){
	var date = this;
	return ('0' + date.getDate()).slice(-2);
}
Date.prototype.toArray = function(){
	var date = this;
	return [date.getFullYear(), date.getMonthWithZeroes(), date.getDateWithZeroes()];
}

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
	.get('/authorize/clear', function(req, res){
		res.clearCookie('access_token');
		res.redirect('/');
	})
	.get('*', function(req, res, next){
		if(process.env['NODE_ENV'] == 'development' || req.cookies['access_token']){
			if(DealProperties == undefined){
				loadDealProperties(req, function(){
					next();
				});
			}else{
				next();
			}
		}else{
			res.redirect('/authorize');
		}
	})
	.get('/deals/properties', function(req, res){
		loadDealProperties(req, function(){
			res.json(DealProperties);
		});
	})
	.get('/deals/history\.:format?', function(req, res){
		var snapshotDate = Math.min(Date.now(), parseInt(req.query.snapshotDate || Date.now()));
		var properties = (req.query.properties || '').split(',');
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
			if(req.params.format == 'tsv'){
				var output = [];
				var csvString;
				var dIndex, deal, pIndex, propertyName, propertyValue;
				var delim = '\t';
				var filename = 'deals_snapshot_' + (new Date(snapshotDate)).toArray().join('-') + '.tsv';
				output.push(properties.join(delim));
				for(dIndex = 0; dIndex < outputDeals.length; dIndex += 1){
					deal = [];
					for(pIndex = 0; pIndex < properties.length; pIndex += 1){
						propertyName = properties[pIndex];
						propertyValue = outputDeals[dIndex][propertyName];
						if(propertyValue && ['date', 'datetime'].includes(DealProperties[propertyName].type)){
							propertyValue = (new Date(parseInt(propertyValue))).toArray().join('-');
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
					res.json(apiResponse);
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
			var output = {
				dealId: deal.dealId,
				createdate: deal.properties.createdate.value
			};
			if(output.createdate > snapshotDate){
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
			outputDeals.push(output);
		}
	})
	.use('/', express.static('./public'));

function loadDealProperties(req, callback){
	HubAPIRequest(req, {
		method: 'GET',
		url: 'https://api.hubapi.com/properties/v1/deals/properties'
	}, function(result){
		DealProperties = {};
		var pIndex, property;
		for(pIndex = 0; pIndex < result.body.length; pIndex++){
			property = result.body[pIndex];
			DealProperties[property.name] = {
				name: property.name,
				label: property.label,
				groupName: property.groupName,
				type: property.type,
				fieldType: property.fieldType
			};
		}
		callback(result);
	});
}

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
