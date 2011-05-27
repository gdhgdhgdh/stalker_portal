//require.paths.unshift(__dirname + '/lib');
var events  = require('events');
var util    = require('util');
var console = require('console.js');

var RESTServer = {

    "start" : function(){

        console.log('Starting REST server...done');

        var http = require('http');

        http.createServer(function(req, res){

            var response = new RESTResponse(res);

            try{
                var request = new RESTRequest(req);
            }catch(e){
                console.error(e.message);
                response.setError(e.message);
                response.send();
                return;
            }

            request.on("end", function(){

                try{
                    var resolver = new RESTCommandResolver();
                    var command  = resolver.getCommand(request);
                }catch(e){
                    console.error(e.message);
                    console.trace();
                    response.setError(e.message);
                    response.send();
                    return;
                }

                command.execute(request, function(res, err){
                    if (err){
                        console.error(err);
                        response.setError(err);
                    }
                    response.setBody(res);
                    response.send();
                });
            });


        }).listen(3000, "0.0.0.0");
    }
};


/**
 * @constructor
 */
function RESTCommandResolver(){}

RESTCommandResolver.prototype.getCommand = function(request){

    var resource = request.getResource().split("_").map(function(part){return part.charAt(0).toUpperCase() + part.slice(1)}).join("");

    var command = require(resource.toLowerCase())['RESTCommand' + resource];

    if (!command){
        throw new RESTCommandResolverException("Resource " + resource + " does not exist");
    }

    if (typeof(command) == "function"){
        return new command;
    }else{
        return command;
    }
};

var RESTCommandResolverException = function(message){
    this.message = message;
};

/**
 * @constructor
 * @param request
 */
function RESTRequest(request){

    this._request = request;

    this._init();
}

util.inherits(RESTRequest, events.EventEmitter);

RESTRequest.prototype._init = function(){

    var params = this._request.url.split("/");
    params.splice(0, 1);

    if (params[params.length - 1] == ''){
        params.splice(params.length - 1, 1);
    }

    if (params.count == 0 || params[0] == ''){
        throw new RESTRequestException("Empty resource");
    }

    this._resource = params[0];

    if (params.length > 1){
        this._identifiers = params[1].split(',');
    }

    var method_map = {"get" : "get", "post" : "create", "put" : "update", "delete" : "del"};

    var method = this._request.method.toLowerCase();

    if (!method_map.hasOwnProperty(method)){
        throw new RESTRequestException("Not supported method");
    }

    this._action = method_map[method];

    var self = this;
    var body = '';

    this._request.on("data", function(chunk){
        if (chunk){
            body += chunk.toString();
        }
    });

    this._request.on("end", function(){
        self._data = require('querystring').parse(body);
        self.emit("end");
    });
};

RESTRequest.prototype.getResource = function(){
    return this._resource;
};

RESTRequest.prototype.getAction = function(){
    return this._action;
};

RESTRequest.prototype.getData = function(){
    return this._data;
};

RESTRequest.prototype.getIdentifiers = function(){
    return this._identifiers;
};

var RESTRequestException = function(message){
  this.message = message;
};

/**
 * @constructor
 * @param response
 */
function RESTResponse(response){

    this._response = response;
    this._msg = {"status" : "OK", "results" : ""};
}

RESTResponse.prototype.setBody = function(body){

    this._msg.results = body;
};

RESTResponse.prototype.setError = function(error){

    this._msg.error  = error;
    this._msg.status = "ERROR";
};

RESTResponse.prototype.send = function(){

    //if (this._msg.error){
    //    this._response.statusCode = 500;
    //}else{
        this._response.statusCode = 200;
    //}

    this._response.setHeader("Content-Type", "application/json");
    console.log(this._msg);
    //this._response.end(JSON.stringify(this._msg, function (key, val) {if (key != 'timer') return val}));
    this._response.end(JSON.stringify(this._msg));
};

module.exports.RESTServer = RESTServer;