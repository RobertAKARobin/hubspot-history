'use strict';

var request = require('request');

var BaseURL = 'https://api.hubapi.com/properties/v1/';

function APIRequest(params){
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
	properties: [
		APIRequest({
			method: 'GET',
			url: BaseURL + 'deals/properties'
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
			res.dealProperties = output;
			next();
		}
	]
}
