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
		console.log(params);
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
				output['dealId'] = {
					name: 'dealId',
					label: 'Deal ID',
					type: 'number',
					fieldType: 'number'
				}
				res.properties = output;
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
					.addIfDoesNotInclude('dealId')
					.addIfDoesNotInclude('createdate')
					.addIfDoesNotInclude('dealname')
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
				res.deals = res.deals.map(stripDeal);
				next();

				function stripDeal(deal){
					var output = {};
					var pIndex, pLength, propertyName, propertyVersions, propertyValue;
					for(pIndex = 0; pIndex < req.snapshot.propertyNames.length; pIndex++){
						propertyName = req.snapshot.propertyNames[pIndex];
						propertyVersions = (deal.properties[propertyName] || {}).versions;
						propertyValue = (propertyVersions || []).reduce(getVersionWithCorrectDate, undefined);
						output[propertyName] = formatPropertyValue(propertyValue, propertyName);
					}
					output.dealId = deal.dealId;
					return output;
				}

				function getVersionWithCorrectDate(accumulator, propertyVersion){
					if(accumulator !== undefined){
						return;
					}else if(propertyVersion.timestamp <= req.snapshot.dateAsNumber){
						return propertyVersion.value;
					}
				}

				function formatPropertyValue(propertyValue, propertyName){
					var propertyType = res.properties[propertyName].type;
					if(propertyValue === undefined){
						return;
					}
					if(propertyType == 'date' || propertyType == 'datetime'){
						return (new Date(parseInt(propertyValue))).toArray().join('-');
					}else if(propertyType == 'number'){
						return parseFloat(propertyValue);
					}else if(propertyType == 'string'){
						return propertyValue.replace(/\t/g, ' ');
					}else{
						return propertyValue;
					}
				}
			},
			function(req, res, next){
				if(req.params.format == 'tsv'){
					next();
				}else{
					res.json(res.deals);
				}
			},
			function(req, res, next){
				var tsv = res.deals.map(function(deal){
					return deal.extractValuesByKeys(req.snapshot.propertyNames).join('\t');
				});
				var filename = 'deals_snapshot_' + req.snapshot.date.toArray().join('-') + '.tsv';

				tsv.unshift(req.snapshot.propertyNames.join('\t'));

				res.set('Content-Type', 'text/tab-separated-values');
				res.set('Content-Disposition', 'attachment; filename=' + filename);
				res.send(tsv.join('\n'));
			}
		];
	}
}
