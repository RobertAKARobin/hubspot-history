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

Array.prototype.addIfDoesNotInclude = function(item){
	var array = this;
	if(array.indexOf(item) < 0){
		array.push(item);
	}
	return array;
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
			next();
		}else{
			res.redirect('/authorize');
		}
	})
	.get('/deals/properties', function(req, res){
		HubAPIRequest(req, {
			method: 'GET',
			url: 'https://api.hubapi.com/properties/v1/deals/properties'
		}, function(result){
			res.json(result);
		});
	})
	.get('/deals/history', function(req, res){
		var snapshotDate = Math.min(Date.now(), parseInt(req.query.snapshotDate || Date.now())) ;
		var properties = (req.query.properties || '').split(',');
		properties
			.addIfDoesNotInclude('createdate')
			.addIfDoesNotInclude('dealname');
		var offset = 0;
		var outputDeals = [];
		var numDealsTotal = 0;
		var numPages = 0;
		var numPerPage = 250;

		loadMoreDeals();

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
					if(apiResponse.body.hasMore){
						offset = apiResponse.body.offset;
						console.log(offset);
						loadMoreDeals();
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
			});
		}

		function appendDeal(deal){
			var pIndex, versions, vIndex, version;
			var output = {
				dealId: deal.dealId,
				createdate: deal.properties.createdate.value
			};
			if(output.createdate > snapshotDate){
				return;
			}
			for(pIndex = 0; pIndex < properties.length; pIndex++){
				propertyName = properties[pIndex];
				if(!deal.properties[propertyName]){
					output[propertyName] = '';
				}else{
					versions = deal.properties[propertyName].versions;
					for(vIndex = 0; vIndex < versions.length; vIndex++){
						version = versions[vIndex];
						if(version.timestamp <= snapshotDate){
							output[propertyName] = version.value
							break;
						}
					}
				}
			}
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
