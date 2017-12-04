'use strict';

Components.snapshot = function(){

	var HubspotPortalID = null;

	var Query = {
		properties: (Location.query().properties ? Location.query().properties.split(',') : []),
		limitToFirst: (Location.query().limitToFirst || false),
		includeHistory: (Location.query().includeHistory || false)
	}

	var state = {
		propertiesLoadingStatus: 0,
		dealsLoadingStatus: 0,
		sortProperty: false,
		sortDirection: false,
		filterError: false
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

	var Deals = (function(){

		var Deals = {
			all: [],
			allFiltered: [],
			properties: [],
			propertiesByName: {},
			propertiesDefault: ['dealname', 'createdate', 'dealstage'],
			propertiesRequested: [],
			calculations: {},
		};
		
		Deals.filter = function(filterString){
			var quotes = [];
			filterString = (filterString || '');
			filterString = filterString
				.replace(/(".*?[^\\]"|'.*?[^\\]')/g, function(match){
					quotes.push(match);
					return '%%%%';
				})
				.replace(/\$/g, 'deal.')
				.replace(/alert\(.*?\)|confirm\(.*?\)|prompt\(.*?\)/g, '')
				.replace(/\bAND\b/gi, '&&')
				.replace(/\bOR\b/gi, '||')
				.replace(/\bNOT\s+/gi, '!')
				.replace(/\s+HAS\s+(%%%%)/gi, '.indexOf(%%%%) > -1')
				.replace(/([^<>])(=+)/g, function(nil, modifier, equalses){
					return modifier + (equalses.length == 1 ? '==' : equalses);
				})
				.replace(/≠/g, '!=')
				.replace(/≥/g, '>=')
				.replace(/≤/g, '<=')
				.replace(/%%%%/g, function(){
					return quotes.shift();
				});
			console.log(filterString)
			try{
				var filterFunction  = new Function('deal', 'return ' + (filterString || 'true'));
				Deals.allFiltered = Deals.all.filter(filterFunction);
				Deals.calculations = {};
				Deals.propertiesRequested.forEach(function(propertyName){
					var property = Deals.propertiesByName[propertyName];
					if(property.type == 'number' || property.type == 'currency'){
						Deals.calculations[propertyName] = Deals.allFiltered.reduce(Deals.sumBy(property.name), 0);
					}
				});
			}catch(e){
				state.filterError = true;
				return false;
			}
		}
		Deals.formatProperties = function(deal){
			Deals.propertiesRequested.forEach(Deals.formatOneProperty.bind(deal));
		}
		Deals.formatOneProperty = function(propertyName){
			var deal = this;
			var value = deal[propertyName];
			switch(Deals.propertiesByName[propertyName].type){
				case 'datetime':
					value = (new Date(parseInt(value)))._toPrettyString();
					break;
				case 'currency':
					value = (parseFloat(value) || 0).toFixed(2);
					break;
				case 'number':
					value = (parseFloat(value) || 0);
					break;
			}
			deal[propertyName] = value;
		}
		Deals.load = function(){
			var qs = JSON.parse(JSON.stringify(Location.query()));
			qs.properties = Deals.propertiesDefault.concat(qs.properties).join(',');
			state.dealsLoadingStatus = 1;
			Deals.all = [];
			m.request({
				method: 'GET',
				url: './deals/snapshot',
				data: qs
			}).then(function(response){
				HubspotPortalID = response.hubspotPortalID;
				Deals.propertiesRequested = Object.keys(response.requestedProperties);
				Deals.all = Object.values(response.deals);
				Deals.all.forEach(Deals.formatProperties);
				Deals.filter('');
				state.dealsLoadingStatus = 2;
			});
		}
		Deals.loadProperties = function(){
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
		Deals.sort = function(){
			var property = this;
			state.sortProperty = property.name;
			state.sortDirection = (state.sortDirection == 'asc' ? 'desc' : 'asc');
	
			var fieldType = Deals.propertiesByName[state.sortProperty].type;
			Deals.allFiltered._sortOn(function(deal){
				var value = deal[state.sortProperty];
				if(fieldType == 'number' || fieldType == 'currency'){
					return parseFloat(value || 0);
				}else if(value){
					return (value || '').toString().toLowerCase().replace(/[^a-zA-Z0-9]/g,'');
				}
			});
			if(state.sortDirection == 'asc'){
				Deals.allFiltered.reverse();
			}
		}
		Deals.sumBy = function(propertyName){
			return function(sum, deal){
				return sum + parseFloat(deal[propertyName]);
			}
		}

		return Deals;
	})();

	var SidebarView = function(){
		var views = {
			properties: function(){
				return [
					m('p', "Select properties:"),
					m('div.select', [
						m('table', [
							Deals.properties.map(views.selectablePropertyRow)
						])
					]),
					m('p', "De-select properties:"),
					m('div.select', [
						m('table', [
							Deals.propertiesDefault.concat(Query.properties).map(views.nonSelectablePropertyRow)
						])
					])
				]
			},
			selectablePropertyRow: function(property){
				return m('tr', [
					m('td', {
						'data-isHidden': (Deals.propertiesDefault.includes(property.name) || Query.properties.includes(property.name)),
						onclick: addPropertyToQueryString.bind(property),
						title: property.name
					}, [
						property.label,
						m('span.paren', property.name)
					])
				])
			},
			nonSelectablePropertyRow: function(propertyName){
				var isDefaultDealProperty = Deals.propertiesDefault.includes(propertyName);
				var property = Deals.propertiesByName[propertyName];
				if(property){
					return m('tr', [
						m('td', {
							'data-disabled': isDefaultDealProperty,
							title: property.name,
							onclick: (isDefaultDealProperty ? null : removePropertyFromQueryString.bind(property))
						}, [
							property.label,
							m('span.paren', property.name)
						])
					])
				}
			}
		}

		return m('div.controls', [
			views.properties(),
			m('button', {
				onclick: Deals.load
			}, 'Load')
		]);
	}

	var DealsView = function(){
		var views = {
			filterRow: function(){
				return m('tr', [
					m('td', {
						colspan: (Deals.propertiesRequested.length + 1)
					}, [
						m('input', {
							placeholder: 'Enter filter',
							hasError: !!(state.filterError),
							oninput: function(){
								state.filterError = false;
							},
							onkeyup: function(event){
								var isReturn = (event.keyCode == 13);
								if(isReturn){
									event.preventDefault();
									Deals.filter(event.target.value);
								}
							}
						})
					])
				])
			},
			headerTitlesRow: function(isClickable){
				return m('tr', [
					m('th', {
						title: 'dealId'
					}, '#'),
					Deals.propertiesRequested.map(function(propertyName){
						var property = Deals.propertiesByName[propertyName];
						return m('th', {
							title: property.name,
							'data-propertyType': property.type,
							'data-sortProperty': property.name,
							'data-enabled': !!(isClickable),
							'data-sortDirection': (state.sortProperty == property.name ? state.sortDirection : false),
							onclick: (isClickable ? Deals.sort.bind(property) : false)
						}, property.label)
					})
				])
			},
			headerCalculationsRow: function(){
				return m('tr.subheader', [
					m('td'),
					Deals.propertiesRequested.map(function(propertyName){
						var property = Deals.propertiesByName[propertyName];
						var value = Deals.calculations[property.name];
						if(value){
							if(property.type == 'currency'){
								value = value.toFixed(2);
							}
						}
						return m('td', {
							'data-propertyType': property.type
						}, value);
					})
				])
			},
			dataRow: function(deal, dealIndex){
				return m('tr', [
					m('td', [
						m('a', {
							title: 'dealId',
							href: 'https://app.hubspot.com/sales/' + HubspotPortalID + '/deal/' + deal.dealId
						}, Deals.allFiltered.length - dealIndex)
					]),
					Deals.propertiesRequested.map(views.dataColumn.bind(deal))
				])
			},
			dataColumn: function(propertyName){
				var deal = this;
				var property = Deals.propertiesByName[propertyName];
				return m('td', {
					'data-propertyType': property.type,
				}, deal[property.name]);
			}
		}

		return [
			m('table.dealHeaders', [
				m('thead.dealHeaderColumns', [
					views.headerTitlesRow(true),
					(Object.keys(Deals.calculations).length > 0 ? views.headerCalculationsRow() : null),
					views.filterRow()
				])
			]),
			m('table.dealRows', [
				m('thead.dealHeaderColumnsDummy', [
					views.headerTitlesRow()
				]),
				m('tbody', [
					Deals.allFiltered.map(views.dataRow)
				])
			])
		]
	}

	return {
		oninit: function(){
			Deals.loadProperties();
		},
		onupdate: function(){
			var hiddenDealHeaders = document.querySelectorAll('.dealHeaderColumnsDummy th');
			var dealHeaders = document.querySelectorAll('.dealHeaderColumns th');
			for(var i = 0; i < hiddenDealHeaders.length; i++){
				dealHeaders[i].style.width = hiddenDealHeaders[i].clientWidth + 'px';
			}
		},
		view: function(){
			return m('div.wrap', [
				m('div.sidebar', [
					m('h1', 'Hubspot Deals'),
					(
						state.propertiesLoadingStatus == 2
						? SidebarView()
						: m('p', 'Loading...')
					)
				]),
				m('div.body', [
					(
						state.dealsLoadingStatus == 2
						? DealsView()
						: m('div.dealLoadStatus',
							state.dealsLoadingStatus == 1
							? m('p', 'Loading...')
							: m('p', 'No deals loaded.')
						)
					)
				])
			])
		}
	}

}
