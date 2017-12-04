'use strict';

var SidebarView = function(){
	var views = {
		selectablePropertyRow: function(property){
			return m('tr', [
				m('td', {
					'data-isHidden': (Deals.defaultPropertyNames.includes(property.name) || Query.properties.includes(property.name)),
					onclick: addPropertyToQueryString.bind(property),
					title: property.name
				}, [
					property.label,
					m('span.paren', property.name)
				])
			])
		},
		nonSelectablePropertyRow: function(propertyName){
			var isDefaultDealProperty = Deals.defaultPropertyNames.includes(propertyName);
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
				Deals.defaultPropertyNames.concat(Query.properties).map(views.nonSelectablePropertyRow)
			])
		]),
		m('button', {
			onclick: API.getDeals
		}, 'Load')
	]
}
