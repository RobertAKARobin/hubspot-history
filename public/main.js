'use strict';

Array.prototype.sortOn = function(sortProperty){
	var array = this;
	var sortFunction = ((sortProperty instanceof Function) ? sortProperty : function(item){
		return item[sortProperty];
	});
	return array.sort(function(itemA, itemB){
		var valA = (sortFunction(itemA) || 0);
		var valB = (sortFunction(itemB) || 0);
		if(valA > valB){
			return 1
		}else if(valA < valB){
			return -1
		}else{
			return 0;
		}
	});
}
Date.prototype.getMonthWithZeroes = function(){
	var date = this;
	return ('0' + (date.getMonth()+1)).slice(-2);
}
Date.prototype.getDateWithZeroes = function(){
	var date = this;
	return ('0' + date.getDate()).slice(-2);
}
Date.prototype.toArray = function(){
	var date = this;
	return [date.getFullYear(), date.getMonthWithZeroes(), date.getDateWithZeroes()];
}
Object.defineProperty(Object.prototype, 'merge', {
	enumerable: false,
	value: function(input){
		var object = this;
		for(var key in object){
			input[key] = object[key];
		}
		return input;
	}
})
Location.query = function(paramsObject){
	var query = m.parseQueryString((window.location.href.match(/\?.*?$/g) || [])[0]);
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

	var Today = (new Date()).toArray();

	var Input = {
		year: m.stream(Location.query().year || Today[0]),
		month: m.stream(Location.query().month || Today[1]),
		day: m.stream(Location.query().day || Today[2]),
		properties: (Location.query().properties || '').split(',')
	}

	var state = {
		isLoaded: false
	}

	var refreshDeals = function(){
		state.isLoaded = false;
		m.request({
			method: 'GET',
			url: './deals/properties'
		}).then(function(response){
			if(response.statusCode == 401){
				location.href = "/authorize/reset";
			}else{
				DealProperties = Object.values(response).sortOn(function(item){
					return (item.name || item.label);
				});
				state.isLoaded = true;
			}
		});
	}

	var views = {
		input: function(stream){
			return {
				value: stream(),
				oninput: function(event){
					event.redraw = false;
					stream(event.target.value);
					Location.query(Input);
				}
			}
		},
		date: function(){
			return m('label', [
				m('span', "Take a snapshot of what date? (Y/M/D)"),
				m('div.numbers', [
					m('input[type=number]', views.input(Input.year).merge({
						min: 2012,
						max: 2022,
						placeholder: 'YYYY'
					})),
					m('input[type=number]', views.input(Input.month).merge({
						min: 1,
						max: 12,
						placeholder: 'MM'
					})),
					m('input[type=number]', views.input(Input.day).merge({
						min: 1,
						max: 31,
						placeholder: 'DD'
					}))
				])
			])
		},
		properties: function(){
			return m('label', [
				m('span', [
					"Which Deal properties should be included in the snapshot? Pick multiple by holding 'Shift' while you click. ",
					m('a', {
						onclick: refreshDeals
					}, 'Refresh the list')
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
						Input.properties = properties.join(',');
						Location.query(Input);
					}
				}, DealProperties.map(function(property){
					return m('option', {
						value: property.name,
						selected: Input.properties.includes(property.name)
					}, property.label || property.name)
				}))
			])
		},
		submit: function(){
			return m('label', [
				m('span', 'May take 10+ seconds.'),
				m('button', {
					onclick: function(event){
						event.redraw = false;
						window.open('./deals/snapshot.tsv' + window.location.search);
					}
				}, 'Download')
			])
		}
	}

	return {
		oninit: function(){
			refreshDeals();
		},
		view: function(){
			if(state.isLoaded){
				return [
					views.date(),
					views.properties(),
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
