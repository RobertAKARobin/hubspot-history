'use strict';

var SidebarView = (function(){
	var views = {
		selectablePropertyRow: function(property){
			return m('tr', [
				m('td', {
					'data-isHidden': (Deals.defaultPropertyNames.includes(property.name) || Query.properties.includes(property.name)),
					onclick: addPropertyToQueryString.bind(property),
					title: property.name
				}, [
					property.label,
					m('span.paren', '$' + property.name)
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
						m('span.paren', '$' + property.name)
					])
				])
			}
		},
		Main: function(){
			return [
				m('p', "Selected:"),
				m('div.select', [
					m('table', [
						Deals.defaultPropertyNames.concat(Query.properties).map(views.nonSelectablePropertyRow)
					])
				]),
				m('p', "Not selected:"),
				m('div.select', [
					m('table', [
						Deals.properties.map(views.selectablePropertyRow)
					])
				]),
				m('button', {
					onclick: API.getDeals
				}, 'Load')
			]
		}
	}

	return {
		oninit: function(){
			API.getProperties();
		},
		onupdate: function(){
			var hiddenDealHeaders = document.querySelectorAll('.dealHeaderColumnsDummy th');
			var dealHeaders = document.querySelectorAll('.dealHeaderColumns th');
			for(var i = 0; i < hiddenDealHeaders.length; i++){
				dealHeaders[i].style.width = hiddenDealHeaders[i].clientWidth + 'px';
			}
		},
		view: function(){
			if(state.propertiesLoadingStatus == 2){
				return views.Main();
			}else{
				return m('p', 'Loading...');
			}
		}
	}
})();
