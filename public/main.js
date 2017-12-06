'use strict';

Location.query = function(paramsObject, doClear){
	var query = (doClear ? {} : m.parseQueryString((window.location.href.match(/\?.*?$/g) || [])[0]));
	var newurl = window.location.origin + window.location.pathname;
	if(paramsObject){
		for(var key in paramsObject){
			query[key] = paramsObject[key];
		}
		newurl += '?' + m.buildQueryString(query);
		window.history.pushState({path: newurl}, '', newurl);
	}
	return query;
}

var HubspotPortalID = null;

var Query = {
	properties: (Location.query().properties ? Location.query().properties.split(',') : []),
	limitToFirst: (Location.query().limitToFirst || false),
	includeHistory: (Location.query().includeHistory || false),
	filter: (Location.query().filter || null)
}

var state = {
	propertiesLoadingStatus: 0,
	dealsLoadingStatus: 0,
	sortProperty: false,
	sortDirection: false,
	filterError: false,
	enteredFilter: Query.filter,
	calcTypes: {}
}

var addPropertyToQueryString = function(event){
	var property = this;
	Query.properties._addIfDoesNotInclude(property.name);
	updateQueryString();
}
var removePropertyFromQueryString = function(event){
	var property = this;
	Query.properties._remove(property.name);
	updateQueryString();
}
var updateQueryString = function(){
	var qs = {};
	for(var propertyName in Query){
		if(Query[propertyName]){
			qs[propertyName] = Query[propertyName];
		}
	}
	qs.properties = Query.properties.join(',');
	Location.query(qs, true);
}

var API = {
	getDeals: function(){
		var qs = JSON.parse(JSON.stringify(Location.query()));
		qs.properties = Deals.defaultPropertyNames.concat(qs.properties).join(',');
		state.dealsLoadingStatus = 1;
		Deals.all = [];
		m.request({
			method: 'GET',
			url: './deals/snapshot',
			data: qs
		}).then(function(response){
			HubspotPortalID = response.hubspotPortalID;
			Deals.propertiesRequested = response.requestedProperties;
			Deals.all = Object.values(response.deals);
			Object.values(Deals.propertiesRequested).forEach(function(property){
				Deals.formatProperty(property);
				switch(property.type){
					case 'number':
						state.calcTypes[property.name] = 'avg';
						break;
					case 'currency':
						state.calcTypes[property.name] = 'sum';
						break;
				}
			});
			Deals.filter(Query.filter);
			state.dealsLoadingStatus = 2;
		}).catch(function(error){
			state.dealsLoadingStatus = 3;
			console.log(error)
		});
	},
	getProperties: function(){
		state.propertiesLoadingStatus = 0;
		m.request({
			method: 'GET',
			url: './deals/properties'
		}).then(function(response){
			if(response.statusCode == 401){
				location.href = "/authorize/reset";
			}else{
				Deals.propertiesByName = response;
				Deals.properties = Object.values(Deals.propertiesByName)._sortOn(function(item){
					return (item.label || item.name);
				});
				state.propertiesLoadingStatus = 2;
			}
		});
	}
}

window.addEventListener('DOMContentLoaded', function(){
	m.mount(document.getElementById('properties'), SidebarView);
	m.mount(document.getElementById('data'), DealsView);
});
