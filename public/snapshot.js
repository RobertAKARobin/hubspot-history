'use strict';

Components.snapshot = function(){

    var Deals = [];
    var RequestedProperties = [];
    var DealProperties = [];
    var DealPropertiesByName = {};

    var Query = {
        properties: (Location.query().properties || false),
        limitToFirst: (Location.query().limitToFirst || false),
        includeHistory: (Location.query().includeHistory || false)
    }

    var state = {
        isLoaded: false
    }

    var addPropertyToQueryString = function(event){
        var element = event.target;
        var propertyName = element.getAttribute('propertyName');
        var qs = {};

        Query.properties = (Query.properties ? Query.properties.split(',') : []);
        Query.properties._addIfDoesNotInclude(propertyName);
        Query.properties = Query.properties.join(',');
        for(var propertyName in Query){
            if(Query[propertyName]){
                qs[propertyName] = Query[propertyName];
            }
        }
        Location.query(qs, true);
    }
    var formatDealProperties = function(deal){
        RequestedProperties.forEach(formatDealProperty.bind(deal));
    }
    var formatDealProperty = function(property){
        var deal = this;
        var value = deal[property.name];
        switch(property.type){
            case 'datetime':
                value = (new Date(parseInt(value)))._toPrettyString();
                break;
        }
        deal[property.name] = value;
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
        properties: function(){
            return m('label', [
                m('p', "Which Deal properties should be included in the snapshot?"),
                m('div.select', [
                    m('table', [
                        DealProperties.map(function(property){
                            return m('tr', [
                                m('td', {
                                    propertyName: property.name,
                                    onclick: addPropertyToQueryString
                                }, property.label)
                            ])
                        })
                    ])
                ]),
                m('div.select', [
                    m('table', [
                        Query.properties.split(',').map(function(propertyName){
                            return m('tr', [
                                m('td', DealPropertiesByName[propertyName].label)
                            ])
                        })
                    ])
                ])
            ])
        },
        dealHeaders: function(){
            return m('tr', [
                m('th', 'Id'),
                RequestedProperties.map(function(property){
                    return m('th', property.label)
                })
            ])
        },
        dealRow: function(deal){
            return m('tr', [
                m('td', deal.dealId),
                RequestedProperties.map(views.dealColumn.bind(deal))
            ])
        },
        dealColumn: function(property){
            var deal = this;
            return m('td', deal[property.name]);
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
                    var defaultProperties = ['createdate', 'dealname', 'dealstage'];
                    defaultProperties.forEach(function(propertyName){
                        delete response[propertyName];
                    });
                    DealPropertiesByName = response;
                    DealProperties = Object.values(DealPropertiesByName)._sortOn(function(item){
                        return (item.label || item.name);
                    });
                    state.isLoaded = true;
                }
            });
        },
        view: function(){
            if(state.isLoaded){
                return m('div.wrap', [
                    m('div.sidebar', [
                        m('div', [
                            m('h1', 'Hubspot Snapshot'),
                            views.properties(),
                            m('button', {
                                onclick: function(event){
                                    Deals = [];
                                    m.request({
                                        method: 'GET',
                                        url: './deals/snapshot',
                                        data: Location.query()
                                    }).then(function(response){
                                        RequestedProperties = Object.values(response.requestedProperties);
                                        Deals = Object.values(response.deals);
                                        Deals.forEach(formatDealProperties);
                                    });
                                }
                            }, 'Load')
                        ])
                    ]),
                    m('div.body', [
                        m('table', [
                            m('thead', [
                                views.dealHeaders()
                            ]),
                            m('tbody', [
                                Deals.map(views.dealRow)
                            ])
                        ])
                    ])
                ])
            }else{
                return [
                    m('p', 'Loading Deal properties...')
                ]
            }
        }
    }

}
