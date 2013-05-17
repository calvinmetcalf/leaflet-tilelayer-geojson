L.Util.ajax = function (url,options, cb) {
    var cbName,ourl,cbSuffix,scriptNode, head, cbParam, XMHreq;
	if(typeof options === "function"){
		cb = options;
		options = {};
	}
	if(options.jsonp){
		head = document.getElementsByTagName('head')[0];
		cbParam = options.cbParam || "callback";
		if(options.callbackName){
			cbName= options.callbackName;
		}else{
			cbSuffix = "_" + ("" + Math.random()).slice(2);
			cbName = "L.Util.ajax.cb." + cbSuffix;
		}
		scriptNode = L.DomUtil.create('script', '', head);
		scriptNode.type = 'text/javascript';
		if(cbSuffix) {
			L.Util.ajax.cb[cbSuffix] = function(data){
				head.removeChild(scriptNode);
				delete L.Util.ajax.cb[cbSuffix]
				cb(data);
			};
		}
		if (url.indexOf("?") === -1 ){
			ourl =  url+"?"+cbParam+"="+cbName;
		}else{
			ourl =  url+"&"+cbParam+"="+cbName;
		}
		scriptNode.src = ourl;
		return {abort:function(){head.removeChild(scriptNode);
    			delete L.Util.ajax.cb[cbSuffix];
                return true
            }
        }
	}else{	
		// the following is from JavaScript: The Definitive Guide
		if (window.XMLHttpRequest === undefined) {
			XMHreq = function() {
				try {
					return new ActiveXObject("Microsoft.XMLHTTP.6.0");
				}
				catch  (e1) {
					try {
						return new ActiveXObject("Microsoft.XMLHTTP.3.0");
					}
					catch (e2) {
						throw new Error("XMLHttpRequest is not supported");
					}
				}
			};
		}else{
			XMHreq = window.XMLHttpRequest
		}
		var response, request = new XMHreq();
		request.open("GET", url);
		request.onreadystatechange = function() {
			if (request.readyState === 4 && request.status === 200) {
				if(window.JSON) {
					response = JSON.parse(request.responseText);
				} else {
					response = eval("("+ request.responseText + ")");
				}
				cb(response);
			}
		};
		request.send();	
		return request;
	}
};
L.Util.ajax.cb = {};
L.TileLayer.GeoJSON = L.TileLayer.extend({
    _requests: [],
    _data: [],
    _geojson: {"type":"FeatureCollection","features":[]},
    initialize: function (url, options, geojsonOptions) {
        if(options.jsonp){
            this.jsonp=true;
        }
        L.TileLayer.prototype.initialize.call(this, url, options);
        this.geojsonLayer = new L.GeoJSON(this._geojson, geojsonOptions);
        this.geojsonOptions = geojsonOptions;
    },
     onAdd: function (map) {
        this._map = map;
        L.TileLayer.prototype.onAdd.call(this, map);
        this.on('load', this._tilesLoaded);
        map.addLayer(this.geojsonLayer);
    },
    onRemove: function (map) {
        map.removeLayer(this.geojsonLayer);
        this.off('load', this._tilesLoaded);
        L.TileLayer.prototype.onRemove.call(this, map);
    },
    data: function () {
         this._geojson.features = [];
        if (this.options.unique) {
            this._uniqueKeys = {};
        }
        var tile,t,len1;
        for (t,len1=this._tiles.length;t<len1;t++) {
            tile = this._tiles[t];
            if (!tile.processed) {
                this._data = this._data.concat(tile.datum);
                tile.processed = true;
            }
        }
        var tileData= this._data,tileDatum,f,len2,featureKey;
        for (t,len1=tileData.length;t<len1;t++) {
            tileDatum = tileData[t];
            if (tileDatum && tileDatum.features) {

                // deduplicate features by using the string result of the unique function
                if (this.options.unique) {
                    for (f,len2=tileDatum.features.length;f<len2;f++) {
                        featureKey = this.options.unique(tileDatum.features[f]);
                        if (this._uniqueKeys.hasOwnProperty(featureKey)) {
                            delete tileDatum.features[f];
                        }
                        else {
                            this._uniqueKeys[featureKey] = featureKey;
                        }
                    }
                }
                this._geojson.features =
                    this._geojson.features.concat(tileDatum.features);
            }
        }
        return this._geojson;
    },
    _addTile: function(tilePoint, container) {
        var tile = { datum: null, processed: false };
        this._tiles[tilePoint.x + ':' + tilePoint.y] = tile;
        this._loadTile(tile, tilePoint);
    },
    // Load the requested tile via AJAX
    _loadTile: function (tile, tilePoint) {
        this._adjustTilePoint(tilePoint);
        var layer = this;
        var req = L.Util.ajax(this.getTileUrl(tilePoint),{jsonp:this.jsonp},function(data){
            tile.datum=data;
            layer._tileLoaded();
        });
        this._requests.push(req);
    },
    _resetCallback: function() {
        this._geojson.features = [];
        this._data = [];
        L.TileLayer.prototype._resetCallback.apply(this, arguments);
        for (var i in this._requests) {
            this._requests[i].abort();
        }
        this._requests = [];
    },
    _update: function() {
        if (this._map._panTransition && this._map._panTransition._inProgress) { return; }
        if (this._tilesToLoad < 0) this._tilesToLoad = 0;
        L.TileLayer.prototype._update.apply(this, arguments);
    },
    _tilesLoaded: function (evt) {
        this.geojsonLayer.clearLayers();
        this.data();
    }
});
L.tileLayer.geoJson=function(a,b,c){
    return new L.TileLayer.GeoJSON(a,b,c);
}