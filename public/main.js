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

var Controls = (function(){

	var DealProperties = [];

	var Today = (new Date())._toArray();

	var Query = {
		year: m.stream(Location.query().year || Today[0]),
		month: m.stream(Location.query().month || Today[1]),
		day: m.stream(Location.query().day || Today[2]),
		properties: (Location.query().properties || '').toString().split(','),
		limitToFirst: m.stream(Location.query().limitToFirst || false),
		includeTime: m.stream(Location.query().includeTime || false),
		toJson: m.stream(Location.query().toJson || false)
	}

	var state = {
		isLoaded: false,
		showAdvanced: false
	}

	var updateQuerystring = function(){
		var qs = JSON.parse(JSON.stringify(Query));
		qs.properties = qs.properties.join(',');
		for(var propertyName in qs){
			if(qs[propertyName] == false){
				delete qs[propertyName];
			}
		}
		Location.query(qs, true);
	}

	var views = {
		input: function(stream){
			return {
				value: stream(),
				oninput: function(event){
					event.redraw = false;
					stream(event.target.value);
					updateQuerystring();
				}
			}
		},
		checkbox: function(stream){
			return [
				m('input[type=checkbox]', {
					checked: stream(),
					onchange: function(event){
						var currentStreamValue = stream();
						stream(!currentStreamValue);
						updateQuerystring();
					}
				}),
				m('span')
			]
		},
		date: function(){
			return m('label', [
				m('p', "Take a snapshot of what date? (Y/M/D)"),
				m('div.numbers', [
					m('input[type=number]', views.input(Query.year)._merge({
						min: 2012,
						max: 2022,
						placeholder: 'YYYY'
					})),
					m('input[type=number]', views.input(Query.month)._merge({
						min: 1,
						max: 12,
						placeholder: 'MM'
					})),
					m('input[type=number]', views.input(Query.day)._merge({
						min: 1,
						max: 31,
						placeholder: 'DD'
					}))
				])
			])
		},
		properties: function(){
			return m('label', [
				m('div', [
					m('p', "Which Deal properties should be included in the snapshot?"),
					m('p', "'Deal ID', 'Deal Name', 'Deal Stage', and 'Create Date' are always included."),
					m('p', "Select multiple by holding 'Shift' or 'Command'/'Control' while you click.")
				]),
				m('select', {
					multiple: true,
					onchange: function(event){
						event.redraw = false;
						var select = event.target;
						var options = select.options;
						var properties = [];
						for(var i = 0; i < options.length; i++){
							if(options[i].selected){
								properties.push(options[i].value);
							}
						}
						Query.properties = properties;
						updateQuerystring();
					}
				}, DealProperties.map(function(property){
					return m('option', {
						value: property.name,
						selected: Query.properties.includes(property.name)
					}, property.label || property.name)
				}))
			])
		},
		advanced: function(){
			return [
				m('label', [
					m('p', 'View as .json instead of .tsv?'),
					m('span', views.checkbox(Query.toJson))
				]),
				m('label', [
					m('p', 'Download first 250 only?'),
					m('span', views.checkbox(Query.limitToFirst))
				]),
				m('label', [
					m('p', 'For each property, display the timestamp of when it got its value?*'),
					m('span', views.checkbox(Query.includeTime))
				]),
				m('p', "*If you create a Deal/Opportunity in Salesforce in January, and then import it into Hubspot in March, the 'createdate' will be January, but the timestamp for the Deal's properties will be March.")
			]
		},
		submit: function(){
			return m('label', [
				m('p', 'May take 10+ seconds.'),
				m('button', {
					onclick: function(event){
						event.redraw = false;
						window.open('./deals/snapshot' + window.location.search);
					}
				}, 'Download')
			])
		}
	}

	return {
		oninit: function(){
			state.isLoaded = false;
			m.request({
				method: 'GET',
				url: './deals/properties'
			}).then(function(response){
				if(response.statusCode == 401){
					location.href = "/authorize/reset";
				}else{
					DealProperties = Object.values(response)._sortOn(function(item){
						return (item.name || item.label);
					});
					state.isLoaded = true;
				}
			});
		},
		view: function(){
			if(state.isLoaded){
				return [
					views.date(),
					views.properties(),
					m('label.toggle', {
						active: (state.showAdvanced),
						onclick: function(event){
							state.showAdvanced = !(state.showAdvanced);
						}
					}, 'Advanced'),
					(state.showAdvanced ? views.advanced() : null),
					views.submit()
				]
			}else{
				return [
					m('p', 'Loading Deal properties...')
				]
			}
		}
	}

})();

window.addEventListener('DOMContentLoaded', function(){
	m.mount(document.getElementById('display'), Controls);
});
