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
				res.numRequests = 0;

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
					res.numRequests += 1;
					res.deals = res.deals.concat(apiResponse.deals.map(stripDeal));
					if(!apiResponse.hasMore || req.query.limitToFirst){
						next();
					}else{
						req.offset = apiResponse.offset;
						loadMoreDeals();
					}
				}

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
			}
		];

		
/*
		// function onComplete(){
		// 	properties.unshift('dealId');
		// 	if(req.params.format == 'tsv'){
		// 		var output = [];
		// 		var csvString;
		// 		var dIndex, deal, pIndex, propertyName, propertyValue, propertyType;
		// 		var delim = '\t';
		// 		var filename = 'deals_snapshot_' + snapshotDate.toArray().join('-') + '.tsv';
		// 		output.push(properties.join(delim));
		// 		for(dIndex = 0; dIndex < outputDeals.length; dIndex += 1){
		// 			deal = [];
		// 			for(pIndex = 0; pIndex < properties.length; pIndex += 1){
		// 				propertyName = properties[pIndex];
		// 				propertyValue = outputDeals[dIndex][propertyName];
		// 				propertyType = DealProperties[propertyName].type;
		// 				if(propertyValue){
		// 					if(propertyName == 'dealstage'){
		// 						propertyValue = DealStages[propertyValue];
		// 					}else if(propertyType == 'date' || propertyType == 'datetime'){
		// 						propertyValue = (new Date(parseInt(propertyValue))).toArray().join('-');
		// 					}else if(propertyType == 'string'){
		// 						propertyValue = propertyValue.replace('\t', ' ');
		// 					}
		// 				}
		// 				deal.push(propertyValue);
		// 			}
		// 			output.push(deal.join(delim));
		// 		}
		// 		csvString = output.join('\n');
		// 		res.set('Content-Type', 'text/tab-separated-values');
		// 		res.set('Content-Disposition', 'attachment; filename=' + filename);
		// 		res.send(csvString);
		// 	}else{
		// 		res.json({
		// 			snapshotDate: snapshotDate,
		// 			properties: properties,
		// 			numPages: numPages,
		// 			numPerPage: numPerPage,
		// 			numDealsTotal: numDealsTotal,
		// 			deals: outputDeals,
		// 			numDealsOutput: outputDeals.length
		// 		});
		// 	}
		// }
*/
		// function appendDeal(deal){
		// 	var pIndex, propertyName, propertyType, versions, vIndex, version;
		// 	var output = {};
		// 	if(deal.properties.createdate.value > snapshotDate){
		// 		return;
		// 	}
		// 	for(pIndex = 0; pIndex < properties.length; pIndex++){
		// 		propertyName = properties[pIndex];
		// 		propertyType = DealProperties[propertyName];

		// 		if(!deal.properties[propertyName]){
		// 			output[propertyName] = '';
		// 		}else{
		// 			versions = deal.properties[propertyName].versions;
		// 			for(vIndex = 0; vIndex < versions.length; vIndex++){
		// 				version = versions[vIndex];
		// 				if(version.timestamp <= snapshotDate){
		// 					output[propertyName] = version.value;
		// 					break;
		// 				}
		// 			}
		// 		}
		// 	}
		// 	output.dealId = deal.dealId;
		// 	outputDeals.push(output);
		// }
	}
}
