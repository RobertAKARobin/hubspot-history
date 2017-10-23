'use strict';

var request = require('request');

var BaseURL = 'https://api.hubapi.com/';

function APIRequest(params){
	params.url = BaseURL + params.url;
	return function(req, res, next){
		if(process.env['NODE_ENV'] == 'development'){
			params.qs = (params.qs || {})
			params.qs['hapikey'] = process.env['HAPIKEY'];
		}else if(process.env['NODE_ENV'] == 'production'){
			params.headers = (params.headers || {});
			params.headers['Authorization'] = 'Bearer ' + req.cookies['access_token'];
		}
		console.log(params.url);
		request(params, function(error, response, body){
			var isAjaxRequest = (req.headers.accept.indexOf('json') > -1);
			var result = {
				success: true,
				statusCode: response.statusCode
			};
			console.log(response.statusCode);
			if(result.statusCode == 401){
				if(isAjaxRequest){
					return res.json(result);
				}else{
					return res.redirect('/authorize');
				}
			}else if(error || result.statusCode >= 400){
				result.success = false;
			}
			try{
				result.body = JSON.parse(body || '{}');
			}catch(e){
				result.body = (error || body);
			}
			res.apiResponse = result;
			next();
		});
	}
}

module.exports = {
	properties: function(){
		return [
			APIRequest({
				method: 'GET',
				url: 'properties/v1/deals/properties'
			}),
			function(req, res, next){
				var properties = res.apiResponse.body;
				var pIndex, property;
				var output = {};
				for(pIndex = 0; pIndex < properties.length; pIndex++){
					property = properties[pIndex];
					output[property.name] = {
						name: property.name,
						label: property.label,
						type: property.type,
						fieldType: property.fieldType
					};
				}
				res.properties = output;
				next();
			}
		]
	},
	stages: function(){
		return [
			APIRequest({
				method: 'GET',
				url: 'deals/v1/pipelines/default'
			}),
			function(req, res, next){
				res.stages = res.apiResponse.body.stages.mapToObject(function(object, stage){
					object[stage.stageId] = stage.label;
				});
				next();
			}
		]
	},
	deals: function(){
		return [
			function(req, res, next){
				var Today = (new Date()).toArray();
				var snapshotDate = new Date(
					(parseInt(req.query.year) || Today[0]),
					(parseInt(req.query.month) || Today[1]),
					(parseInt(req.query.day) || Today[2])
				);
				var propertyNames = Array
					.fromCSV(req.query.properties)
					.addIfDoesNotInclude('createdate')
					.addIfDoesNotInclude('hs_createdate')
					.addIfDoesNotInclude('dealname')
					.addIfDoesNotInclude('dealstage')
					.intersectionWith(Object.keys(res.properties));
				
				req.snapshot = {
					propertyNames: propertyNames,
					date: snapshotDate,
					dateAsNumber: snapshotDate.getTime()
				}
				next();
			},
			function(req, res, next){
				req.offset = 0;
				req.numPerRequest = 250;

				res.deals = [];

				loadMoreDeals();

				function loadMoreDeals(){
					var apiRequest = APIRequest({
						method: 'GET',
						url: 'deals/v1/deal/paged',
						qsStringifyOptions: {
							arrayFormat: 'repeat'
						},
						qs: {
							limit: req.numPerRequest,
							offset: req.offset,
							properties: req.snapshot.propertyNames,
							propertiesWithHistory: true
						}
					});
					apiRequest(req, res, actionAfterAPIResponse);
				}

				function actionAfterAPIResponse(){
					var apiResponse = res.apiResponse.body;
					res.deals = res.deals.concat(apiResponse.deals);
					if(!apiResponse.hasMore || req.query.limitToFirst){
						next();
					}else{
						req.offset = apiResponse.offset;
						loadMoreDeals();
					}
				}
			},
			function(req, res, next){
				if(Array.fromCSV(req.query.properties).indexOf('hs_createdate') < 0){
					req.snapshot.propertyNames.remove('hs_createdate');
				}
				res.deals = res.deals.filter(removeYoungDeals);
				res.deals = res.deals.map(stripDeal);
				next();

				function removeYoungDeals(deal){
					var dealCreateDate = parseInt(deal.properties.createdate.value);
					return (dealCreateDate <= req.snapshot.dateAsNumber);
				}

				function stripDeal(deal){
					var output = {};
					var pIndex, pLength, propertyName, property;
					var targetVersion, versionDate;
					var dateAddedToHS = deal.properties.hs_createdate.timestamp;
					var timeTolerance = 2000;
					for(pIndex = 0; pIndex < req.snapshot.propertyNames.length; pIndex++){
						propertyName = req.snapshot.propertyNames[pIndex];
						property = deal.properties[propertyName];
						if(property){
							if(property.versions.last().timestamp - dateAddedToHS <= timeTolerance){
								targetVersion = property.versions.last();
							}else{
								targetVersion = property.versions.filter(getCorrectVersion)[0];
							}
							if(targetVersion){
								versionDate = new Date(targetVersion.timestamp);
								output[propertyName] = {
									value: formatPropertyValue(targetVersion.value, propertyName),
									time: versionDate.toLocaleString()
								}
							}
						}
					}
					output.dealId = deal.dealId;
					return output;
				}

				function getCorrectVersion(propertyVersion){
					return (propertyVersion.timestamp <= req.snapshot.dateAsNumber);
				}

				function formatPropertyValue(propertyValue, propertyName){
					var propertyType = res.properties[propertyName].type;
					if(propertyName == 'dealstage'){
						return res.stages[propertyValue];
					}else if(propertyType == 'date' || propertyType == 'datetime'){
						return (new Date(parseInt(propertyValue))).toArray().join('-');
					}else if(propertyType == 'number'){
						return parseFloat(propertyValue);
					}else if(propertyType == 'string'){
						return (propertyValue || '').replace(/\t/g, ' ');
					}else{
						return propertyValue;
					}
				}
			}
		];
	}
}
