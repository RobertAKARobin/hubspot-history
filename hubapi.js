'use strict';

module.exports = {
	authorize: function(req, res, next){
		res.redirect('https://app.hubspot.com/oauth/authorize?' + querystring.stringify({
			client_id: process.env['CLIENT_ID'],
			redirect_uri: process.env['REDIRECT_URI'],
			scope: 'contacts'
		}));
	}
}
