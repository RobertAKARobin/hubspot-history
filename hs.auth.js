'use strict';

var querystring = require('querystring');
var request = require('request');

module.exports = {
	check: function(){
		return function(req, res, next){
			if(process.env['NODE_ENV'] == 'development' || req.cookies['access_token']){
				next();
			}else{
				return res.redirect('/authorize');
			}
		}
	},
	init: function(){
		return function(req, res, next){
			res.redirect('https://app.hubspot.com/oauth/authorize?' + querystring.stringify({
				client_id: process.env['CLIENT_ID'],
				redirect_uri: process.env['REDIRECT_URI'],
				scope: 'contacts'
			}));
		}
	},
	redirect: function(){
		return function(req, res, next){
			var requestToken = req.query.code;
			request({
				method: 'POST',
				url: 'https://api.hubapi.com/oauth/v1/token',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
				},
				form: {
					grant_type: 'authorization_code',
					client_id: process.env['CLIENT_ID'],
					client_secret: process.env['CLIENT_SECRET'],
					redirect_uri: process.env['REDIRECT_URI'],
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
		}
	},
	reset: function(){
		return function(req, res, next){
			res.clearCookie('access_token');
			res.redirect('/authorize');
		}
	}
}
