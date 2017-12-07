'use strict';

var DealsView = (function(){

	var calcTypes = [
		'sum',
		'avg',
		'med',
		'mode'
	]

	var views = {
		filterInput: function(){
			return m('input', {
				id: 'filter',
				value: state.enteredFilter,
				placeholder: 'Enter filter...',
				hasError: !!(state.filterError),
				spellcheck: false,
				onkeyup: function(event){
					var isReturn = (event.keyCode == 13);
					var filterString = event.target.value;
					state.filterError = false;
					state.enteredFilter = filterString;
					if(isReturn){
						event.preventDefault();
						Query.filter = filterString;
						try{
							Deals.filter(Query.filter || '');
						}catch(error){
							displayFilterError(error);
						}
						updateQueryString();
						state.sortProperty = null;
						state.sortDirection = null;
					}else{
						event.redraw = false;
					}
				}
			});
		},
		filterRow: function(){
			return m('tr.filterRow', [
				m('td', {
					colspan: Object.keys(Deals.propertiesRequested).length + 1
				}, [
					m('div.tableOptions', [
						m('div', [
							'Showing ' + Deals.allFiltered.length + ' of ' + Deals.all.length + '. ',
							m('a', {
								'data-hasTooltip': true
							}, 'Filter on:'),
							m('span.tooltip', [
								"Filter using the properties you selected. Each property must begin with '$'.",
								"Math operators are >, <, =, ≠, ≥, and ≤.",
								"Logical operators are AND, OR, and NOT.",
								"Use HAS to search for text that contains other text.",
								"Wrap everything but integers in 'quotes.'",
								"",
								"For example:",
								"$dealname = 'Business Company Inc.'",
								"$dealname has 'Business' or $dealname has 'Company'",
								"$createdate ≥ '14/12/01' and $createdate ≤ '14/12/31'",
								"$amount ≠ 0",
								"$amount = 1000",
								"$amount > 5000 and not ($dealstage = 'Lost')"
							].join('\n'))
						]),
						m('div.input', [
							views.filterInput(),
							m('p[isError]', state.filterError)
						])
					])
				])
			])
		},
		formatValueByProperty: function(value, property){
			switch(property.type){
				case 'currency':
					value = (parseFloat(value) || 0)._toDollars();
					break;
				case 'number':
					value = (parseFloat(value) || 0).toString().replace(/(\.[0-9]{2}).*$/, '$1');
					break;
			}
			return value;
		},
		calculate: function(property){
			var calcType = (state.calcTypes[property.name] || 'sum');
			var value = Deals.calculations[property.name][calcType];
			return (views.formatValueByProperty(value, property))
		},
		headerTitlesRow: function(isClickable){
			return m('tr.headerRow', [
				m('th', {
					title: 'dealId'
				}, '$dealId'),
				Object.values(Deals.propertiesRequested).map(function(property){
					return m('th', {
						title: property.name,
						'data-propertyType': property.type,
						'data-sortProperty': property.name,
						'data-enabled': !!(isClickable),
						'data-sortDirection': (state.sortProperty == property.name ? state.sortDirection : false)
					}, [
						m('span.title', {
							onclick: (isClickable ? function(event){
								state.sortProperty = property.name;
								state.sortDirection = (state.sortDirection == 'asc' ? 'desc' : 'asc');
								Deals.sort(property);
								if(state.sortDirection == 'asc'){
									Deals.allFiltered.reverse();
								}
							 } : false)
						}, '$' + property.name),
						(
							property.type == 'number' || property.type == 'currency'
							? m('span.calc', {
								onclick: (isClickable ? function(event){
									state.calcTypes[property.name] = calcTypes._next(state.calcTypes[property.name]);
								} : false)
							}, state.calcTypes[property.name] + ': ' + views.calculate(property))
							: null
						)
					])
				})
			])
		},
		dataRow: function(deal){
			return m('tr.dataRow', [
				m('td', [
					m('a.idlink', {
						title: 'dealId',
						href: 'https://app.hubspot.com/sales/' + HubspotPortalID + '/deal/' + deal.dealId
					}, deal.dealId)
				]),
				Object.values(Deals.propertiesRequested).map(views.dataColumn(deal))
			])
		},
		dataColumn: function(deal){
			return function(property){
				var value = deal[property.name];
				return m('td', {
					'data-propertyType': property.type,
				}, views.formatValueByProperty(value, property));
			}
		},
		Main: function(){
			return [
				m('table.dealHeaders', [
					views.headerTitlesRow('clickable'),
					views.filterRow()
				]),
				m('table.dealData', [
					views.headerTitlesRow(),
					Deals.allFiltered.map(views.dataRow)
				])
			]
		}
	}

	var statusMessages = {
		0: 'No deals loaded.',
		1: 'Loading a lot of data. Wait ten seconds...',
		2: 'Success!',
		3: [
			'The Hubspot server broke. Get a cup of coffee and then try again. Keep an eye on ',
			m('a', {
				href: 'https://status.hubspot.com'
			}, 'status.hubspot.com')
		]
	}

	return {
		onupdate: function(){
			var hiddenDealHeaders = document.querySelectorAll('.dealData .headerRow th');
			var dealHeaders = document.querySelectorAll('.dealHeaders .headerRow th');
			for(var i = 0; i < hiddenDealHeaders.length; i++){
				dealHeaders[i].style.width = hiddenDealHeaders[i].clientWidth + 'px';
			}
		},
		view: function(){
			if(state.dealsLoadingStatus == 2){
				return views.Main();
			}else{
				return m('div.dealLoadStatus', statusMessages[state.dealsLoadingStatus]);
			}
		}
	}
})();
