'use strict';

var hsAPIWrapper = require('hubspot-api-wrapper');
var HS = hsAPIWrapper({
	'authEntryPoint': '/authorize',
	'authExitPoint': '/',
	'cookieName': 'access_token',
	'client_id': process.env['CLIENT_ID'],
	'client_secret': process.env['CLIENT_SECRET'],
	'redirect_uri': process.env['REDIRECT_URI'],
	'hapikey': process.env['HAPIKEY']
});

module.exports = {
	auth: HS.auth,
	getProperties: [
		HS.api({
			method: 'GET',
			url: 'properties/v1/deals/properties'
		}),
		function(req, res, next){
			var properties = res.apiResponse.body;
			var pIndex, property;
			var output = {};
			for(pIndex = 0; pIndex < properties.length; pIndex++){
				property = properties[pIndex];
				if(!property.isDeleted){
					output[property.name] = {
						name: property.name,
						label: (property.label || property.name),
						type: (property.showCurrencySymbol ? 'currency' : property.type),
						fieldType: property.fieldType
					};
				}
			}
			res.properties = output;
			next();
		}
	],
	getStages: [
		HS.api({
			method: 'GET',
			url: 'deals/v1/pipelines/default'
		}),
		function(req, res, next){
			res.stages = res.apiResponse.body.stages._mapToObject(function(stage){
				return {
					key: stage.stageId,
					value: stage.label
				}
			});
			next();
		}
	],
	getDeals: [
		function(req, res, next){

			req.apiOptions = (req.apiOptions || {});
			req.apiOptions.offset = (req.apiOptions.offset || 0);
			req.apiOptions.limit = (req.apiOptions.limit || 250);

			res.deals = [];
			loadMoreDeals();

			function loadMoreDeals(){
				var apiRequest = HS.api({
					method: 'GET',
					url: 'deals/v1/deal/paged',
					qs: req.apiOptions,
					qsStringifyOptions: {
						arrayFormat: 'repeat'
					},
				});
				apiRequest(req, res, actionAfterAPIResponse);
			}

			function actionAfterAPIResponse(){
				var apiResponse = res.apiResponse.body;
				res.deals = res.deals.concat(apiResponse.deals);
				if(!apiResponse.hasMore || req.limitToFirst){
					next();
				}else{
					req.apiOptions.offset = apiResponse.offset;
					loadMoreDeals();
				}
			}
		},
		function(req, res, next){
			var includeVersions = req.apiOptions.propertiesWithHistory;
			res.deals = res.deals._mapToObject(function(deal){
				var output = {
					dealId: deal.dealId,
					versions: {}
				}
				for(var propertyName in deal.properties){
					output[propertyName] = deal.properties[propertyName].value;
					if(includeVersions){
						output.versions[propertyName] = deal.properties[propertyName].versions.map(getVersionData);
					}
				}
				return {
					key: deal.dealId,
					value: output
				}
			});
			next();

			function getVersionData(version){
				return {
					timestamp: version.timestamp,
					value: version.value
				}
			}
		}
	]
}
