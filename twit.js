/*
 * Twit.js
 *
 * A simple, needs-must JavaScript wrapper for the Twitter API.
 *
 * Requires: oauth.js, sha1.js
 *   <http://oauth.googlecode.com/svn/code/javascript/>
 *
 * Copyright 2010, Ben Ward
 *
 * Redistribution and use in source and binary forms, with or without 
 * modification, are permitted provided that the following conditions are met:
 *
 * Redistributions of source code must retain the above copyright notice, this 
 * list of conditions and the following disclaimer.
 * 
 * Redistributions in binary form must reproduce the above copyright notice, 
 * this list of conditions and the following disclaimer in the documentation 
 * and/or other materials provided with the distribution.
 * Neither the name of TwitJS nor the names of its contributors 
 * may be used to endorse or promote products derived from this software  
 * without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" 
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE 
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE 
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE 
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR 
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF 
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS 
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN 
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) 
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE 
 * POSSIBILITY OF SUCH DAMAGE.
 * 
 * If you reuse this code, you must maintain attribution to the original 
 * author(s) of this and any shared components.
 *
 */

/**
 * Create a new TwitJS object instance
 *
 * @param string consumer_key OAuth application consumer key
 * @param string consumer_secret OAuth application consumer seceret
 * @param array options Array of configuration option overrides.
 *
 * Options:
 *
 * @param string options.callback_url URL in your application for Twitter to
 *  callback after authorization. Defaults to 'oob' for Out-of-Band auth.
 * @param string options.api_base The base host name for the Twitter API. Use
 *  this to point to a clone Twitter API instead of actual Twitter. Defaults to
 *  'api.twitter.com'.
 * @param bool options.use_ssl Communicate of HTTPS rather than HTTP. Default: true
 * @param string options.user_agent The HTTP user agent of your application.
 *   Defaults to "Twit.js/vX.X"
 * @param bool options.debug Enable debug logging within the object
 * @param function options.logging_function A custom function to handle log messages.
 *   Defaults to <code>console.log()</code> where available, else <code>alert()</code>
 *
 * @returns TwitJS; the Twitter API wrapper object
 */
TwitJS = function(consumer_key, consumer_secret, options) {
    
    if(undefined === consumer_key) {
        return false;
    }
    if(undefined === consumer_secret) {
        return false;
    }
    
    this.opts = {};
    
    /** Handle override options */
    if('object' !== typeof(options)) {
       options = {};
    }
        
    this.opts.callback_url = options.callback_url || 'oob';
    this.opts.api_base = options.api_base ||  'api.twitter.com';
    this.opts.use_ssl = !!options.use_ssl || true;
    this.opts.user_agent = options.user_agent || this.meta.name+"/"+this.meta.version;
    this.opts.debug = !!options.debug || false;

    /**     
     * Set up debug logging function. 
     *
     * Off by default, enable with opts.debug=true
     * You can also pass a custom logger function if you like, else defaults to
     * console.log, falling back to alert if you're running a very old setup.
     */
    if(false === this.opts.debug) {
        this.log = function(o) { return; };
    }
    else if(undefined !== options.logging_function && 'function' === typeof(options.logging_function) ) {
        this.log = function(o) {
            options.logging_function(o);
        };
    }
    else if(console && console.log) {
        this.log = function(o) {
            console.log(o);
        };
    }
    else {
        this.log = function(o) {
            alert(o);
        };
    }
        
    /** Now that we have error reporting available, check lib prerequesites: */
    if("undefined" === typeof(OAuth)) {
        /**
         * Twit.js requires an OAuth library.
         * @link http://oauth.googlecode.com/svn/code/javascript/
         */
        this.log("OAuth object is missing. You must include oauth.js for twit.js to function.");
        return false;
    }

    if("undefined" === typeof(b64_hmac_sha1)) {
        /**
         * The OAuth library requires SHA-1.
         * @link http://pajhome.org.uk/crypt/md5
         */
        this.log("b64_hmac_sha1 function is missing. OAuth requires this. You must include sha1.js for Twit.js to function.");
        return false;
    }
    
    /**
     * Set up an accessor object for the Twitter API, for use with the OAuth
     * wrapper.
     */
    this.oauth_accessor = {
        consumerKey: consumer_key,
        consumerSecret: consumer_secret,
        serviceProvider: {
            signatureMethod: "HMAC-SHA1",
            requestTokenURL: this._getApiMethodUrl('oauth/request_token'),
            userAuthorizationURL: this._getApiMethodUrl('oauth/authorize'),
            accessTokenURL: this._getApiMethodUrl('oauth/access_token'),
            echoURL: this._getApiMethodUrl('oauth/echo')
        }
    };    
    return this;
};

/* Object Prototype */

/** Define errors */
TwitJS.prototype.E_HTTP_404             = 1; // HTTP 404 response
TwitJS.prototype.E_HTTP_500             = 2; // HTTP 500 response
TwitJS.prototype.E_HTTP_401             = 4; // HTTP 401 response
TwitJS.prototype.E_HTTP_403             = 512; // HTTP 403 Unauthorized response
TwitJS.prototype.E_HTTP_UNKNOWN         = 8; // Some other, unexpected HTTP error
TwitJS.prototype.E_INVALID_METHOD       = 16; // Invalid API method
TwitJS.prototype.E_ERRONEOUS_ERROR      = 32; // Internal error. Tried to set a non-int error code.
TwitJS.prototype.E_AUTH_REQUIRED        = 64; // This method requires authorization.
TwitJS.prototype.E_NOT_IMPLEMENTED_YET  = 128; // Method is TODO
TwitJS.prototype.E_OOB_PIN_NAN          = 256; // Out-of-band PIN is not a number

/** Define Auth states */
TwitJS.prototype.AUTHSTATE_UNREQUESTED  = 0; // API has not been authed yet
TwitJS.prototype.AUTHSTATE_PENDING      = 1; // Request tokens.
TwitJS.prototype.AUTHSTATE_AUTHED       = 2; // Exchanged access tokens

/** Meta */
TwitJS.prototype.meta = {};
TwitJS.prototype.meta.name = "Twit.js";
TwitJS.prototype.meta.version = "v0.1";

/** API Stats */
TwitJS.prototype.api = {};
TwitJS.prototype.api.ratelimit = {};
TwitJS.prototype.api.ratelimit.limit = 1;
TwitJS.prototype.api.ratelimit.remaining = 1;
TwitJS.prototype.api.ratelimit.reset = Date.now();
TwitJS.prototype.api.runtime = 0;
/** 
 * Simple wrapper to make an HTTP Request using XmlHttpRequest
 *
 * There's only one callback. In the event that the request fails,
 * <code>this.last_error</code> will be set and the error should be handled
 * further down the chain.
 *
 * In non-browser environments, override this with a compatible wrapper around
 * whatever HTTP request object is available.
 * 
 * @param string url
 * @param string method HTTP method. GET, POST, PUT, DELETE, etc.
 * @param array headers Array of [name, value] nested arrays. (Uses this format
 *   for consistancy with the OAuth lib, which encourages this for parameters.)
 * @param string body The message body to send with the request
 * @param function callback The callback function to be called when the request is
 *   completed.
 * @returns void
 *
 * @see getLastError()
 * @uses _handleHttpResponse() Pass the status code, headers and body back to TwitJS
 * @public
 */
TwitJS.prototype.httpRequest = function(url, method, headers, body, callback) {
    var _this = this;
    headers = this._handleMethodOptions(headers);
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        switch(xhr.readyState) {
            case 1:
                // XHR open; ready to set headers & send payload
                xhr.setRequestHeader("User-Agent", _this.opts.user_agent);

                // set method headers
                for(var i=0; h = headers[i]; i++) {
                    if(2 === h.length) {
                        xhr.setRequestHeader(h[0], h[1]);
                    }
                    else {
                        _this.log("Invalid HTTP Request Header. Expected 2 parts, got " + h.length + ":");
                        _this.log(h);
                    }
                }

                // send the payload
                if(undefined !== body && null !== body && '' !== body) {
                    xhr.send(body);
                }
                else {
                    xhr.send();
                }
                break;
            case 4:
                _this._handleHttpResponse(
                    xhr.status,
                    xhr.getAllResponseHeaders(),
                    xhr.responseText,
                    callback
                );
                break;
            default:
                break;
        }
    };
    
    // open the request
    xhr.open(method, url);
};

/**
 * Make a signed OAuth request
 *
 * @uses TwitJS.prototype.httpRequest()
 */
TwitJS.prototype._oauthRequest = function(path, method, params, headers, callback) {

    url = this._getApiMethodUrl(path);
    params = this._handleMethodOptions(params);
    headers = this._handleMethodOptions(headers);
    
    // TODO: Time offset related options should also get turned into
    // HTTP caching headers, right?
    
    var message = {
        method: method,
        action: url,
        parameters: params
    };
    OAuth.completeRequest(message, this.oauth_accessor);

    if('POST' === method.toUpperCase() || 'DELETE' === method.toUpperCase()) {
        var body = OAuth.formEncode(message.parameters.filter(this._filterOauthParams));
    }
    else {
        var body = "";
    }
    
    if('GET' === method.toUpperCase()) {
        message.action = OAuth.addToURL(message.action, message.parameters.filter(this._filterOauthParams));
    }

    this.httpRequest(
        message.action,
        message.method,
        headers.concat(
            [['Authorization', OAuth.getAuthorizationHeader("", message.parameters)],
             ['Content-Type', 'application/x-www-form-urlencoded']]
        ),
        body,
        callback
    );
};

/**
 * Filter <code>oauth_</code> parameters from a parameters array
 *
 * POST bodies must not contain <code>oauth_</code> params, so filter them.
 *
 * @param Array 2-length array parameter representation: ['name', 'value']
 * @return bool False if the parameter name begins in 'oauth_'
 */
TwitJS.prototype._filterOauthParams = function(param) {
    return !(param[0].substring(0, 6) === "oauth_");
};

/**
 * Handles optional <code>opts</codes> parameters for OAuth methods
 *
 * Funtions should take options in <code>[[a,b][c,d]]</code> nested array form.
 * That's a convention inherited/maintained from the underlying oauth.js.
 *
 * This function handles null input, and will also convert objects of
 * the form <code>{a:b,c:d}</code> in nested arrays where necessary, since the
 * latter is arguable more intuitive/expected.
 *
 * @param object opts The options input; either an array or key-val object.
 * @return Array A nested array of options.
 */
TwitJS.prototype._handleMethodOptions = function(opts) {
    if(undefined === opts || null === opts) {
        return [];
    }
    else if("object" === typeof(opts) && (opts instanceof Array)) {
        return opts;
    }
    else if("object" === typeof(opts)) {
        var rtn = [];
        for(var key in opts) {
            if(opts.hasOwnProperty(key)) {
                rtn.push([key, opts[key]]);
            }
        }
        return rtn;
    }
    else {
        return [];
    }
};

/**
 * Handle the response of an HTTP Request
 *
 * The httpRequest method should invoke this when it completes a request.
 *
 * @param int status The HTTP status code of the response
 * @param string|array All response headers. Either in [[,],[,]] array form, as
 *   per input headers, or as a single string with one header per row, with headers
 *   separated from values with ': '.
 * @param string body The response body
 * @param Function callback The function to pass the response body to
 * @return void
 *
 * @todo Process JSON responses to extract just the string part of the error message
 */
TwitJS.prototype._handleHttpResponse = function(status, headers, body, callback) {
    this._handleResponseHeaders(headers);
    
    if(undefined === body || null === body) {
        body = '';
    }
    
    switch(status) {
        case 200:
            if('' === body) {
                body = true;
            }
            callback(body);
            break;
        case 404:
            this._setError(this.E_HTTP_404, body);
            callback(false);
            break;
        case 401:
            this._setError(this.E_HTTP_401, body);
            callback(false);
            break;
        case 403:
            this._setError(this.E_HTTP_403, body);
            callback(false);
            break;
        case 500:
            this._setError(this.E_HTTP_500, body);
            callback(false);
            break;
        default:
            this._setError(this.E_HTTP_UNKNOWN, body);
            callback(false);
            break;
    }
};

/**
 * Handles a block of HTTP response headers from all requests.
 *
 * This extracts known special X- headers (related to rate-limiting, and so on)
 * and stuffs them into <code>this.api.*</code>.
 *
 * @param string headers Headers (one per line, ': ' key-value separated), as per
 *   the output of <code>XMLHttpRequest::getAllResponseHeaders()</code>
 * @return void
 */
TwitJS.prototype._handleResponseHeaders = function(headers) {
    headers = headers.split("\n");
    for(var i=0; i < headers.length && (h = headers[i]); i++) {
        kv = h.split(': ');
        switch(kv[0]) {
            case 'X-Ratelimit-Limit':
                this.api.ratelimit.limit = kv[1];
                break;
            case 'X-Ratelimit-Remaining':
                this.api.ratelimit.remaining = kv[1];
                break;
            case 'X-Ratelimit-Reset':
                this.api.ratelimit.reset = kv[1];
                break;
            case 'X-Runtime':
                this.api.runtime = kv[1];
                break;
            default:
                break;
        }
    }
};


/**
 * Generate the full URL for an API method
 * @param endpoint The method URL endpoint. e.g. "oauth/authenticate"
 * @returns string URL to the requested method name.
 * @private
 */
TwitJS.prototype._getApiMethodUrl = function(endpoint) {
    var protocol = (this.opts.use_ssl) ? 'https' : 'http';
    var api_url = protocol + '://' + this.opts.api_base + '/';

    this._getApiMethodUrl = function(e) {
        return api_url + e;
    };
    
    return this._getApiMethodUrl(endpoint);
};

/** 
 * The last error that occured.
 *
 * Faulty methods will return false.
 * Error handlers should call this to find out what went wrong.
 * Keep this bitwise compatible, to allow the horrendous occurance of
 * multiple errors from the same operation.
 * 
 * @private 
 */
TwitJS.prototype._lastError = false;

/**
 * An (optional) English error message describing the last error.
 *
 * The wrapper may include descriptions of errors. Clients may reuse them, or
 * use them for logging and debugging. Clients should not rely on these messages
 * being user-facing-friend.
 *
 * @private
 */
TwitJS.prototype._lastErrorMessage = "";

/**
 * Set the error code for the last error that occured in the system.
 *
 * @param int err The error code
 * @param string message A standard message that could be used to display the error.
 * @return void
 *
 * @uses _setError() Sets E_ERRONEOUS_ERROR if you set an invalid error code. 
 *
 * @private
 */
TwitJS.prototype._setError = function(err, message) {
    if(undefined === message || null === message) {
        message = "";
    }
    if(undefined === err || isNaN(parseInt(err))) {
        this.log("Tried to set an error code that was invalid: " + err);
        this._setError(this.E_ERRONEOUS_ERROR);
    }
    else {
        this._lastError = err;
        this._lastErrorMessage = message;
    }
};

/**
 * @return int Numeric error code for the last error that occured
 * @public
 */
TwitJS.prototype.getLastError = function() {
    return this._lastError;
};

/**
 * @return string A description that could be used to display the error.
 * @public
 */
TwitJS.prototype.getLastErrorMessage = function() {
    return this._lastErrorMessage;
};

/**
 * Immediately return an error if auth is required for a method
 * @uses _setError() Sets E_AUTH_REQUIRED if the method requires user authorization
 * @return bool 
 * @private
 */
TwitJS.prototype._assertAuth = function() {
    if(this.isAuthed()) {
        return true;
    }
    else {
        this._setError(this.E_AUTH_REQUIRED);
        return false;
    }
};

/**
 * Set an E_NOT_IMPLEMENTED_YET error and return false
 * @uses _setError() Sets E_NOT_IMPLEMENTED_YET if the calling method is todo.
 * @return false
 * @private
 */
TwitJS.prototype._notImplementedYet = function() {
    this._setError(this.E_NOT_IMPLEMENTED_YET);
    return false;
};

/** Section: Authorization */

/**
 * Is the user authenticated and keys exchanged such that we can act on
 *   their behalf?
 * @return bool
 * @uses authState() This is a shorthand for AUTHSTATE_AUTHED
 * @public
 * @todo 'hard' param, forcing a request to verify that auth state is still valid/check for revokation
 */
TwitJS.prototype.isAuthed = function() {
    return this.authState() === this.AUTHSTATE_AUTHED;
};

TwitJS.prototype.authState = function() {
    if(undefined === this.oauth_accessor.token 
    && undefined === this.oauth_accessor.tokenSecret) {
        return this.AUTHSTATE_UNREQUESTED;
    }
    else if(!this.oauth_accessor.token.match('^[0-9]+-')) {
        return this.AUTHSTATE_PENDING;
    }
    else {
        return this.AUTHSTATE_AUTHED;
    }
};

/** 
 * Get a request token, before requesting user authorization
 *
 * @param cb Callback function to call once the token has been returned.
 * @private 
 */
TwitJS.prototype._authRequestToken = function(cb) {
    this._oauthRequest(
        'oauth/request_token',
        'POST',
        [],
        [['oauth_callback', this.opts.callback_url]],
        cb
    );
};

/**
 * To access protected resources, the user must be authorized:
 *
 * Will obtain a request token, and then generate a URL to proceed with auth
 * @return The OAuth authorization URL to redirect the user to.
 */
TwitJS.prototype.getAuthorizationUrl = function(cb) {
    var _this = this;
    this._authRequestToken(function(rsp) {
        
        if(false === rsp) {
            return cb(false);
        }
        else {
            var rsp = OAuth.decodeForm(rsp);

            // save the keys
            _this.oauth_accessor.token 
                = OAuth.getParameter(rsp, 'oauth_token');
            _this.oauth_accessor.tokenSecret
                = OAuth.getParameter(rsp, 'oauth_token_secret');

            // generate the authorize url
            return cb(
                _this._getApiMethodUrl('oauth/authorize') 
                + '?oauth_token='
                + _this.oauth_accessor.token
            );
        }
    });
};

/**
 * Authenticate using ‘Connect with Twitter’. Only available for web apps.
 *
 * @uses _setError() Sets E_DESKTOP_CANNOT_AUTHENTICATE if trying to authenticate
 *    when you're running an out-of-band application.
 * @return The authentication URL to redirect the user to; authentication for the app
 * @notimplementedyet
 */
TwitJS.prototype.getAuthenticationUrl = function(cb) {
    if(undefined === opts.callback_url || 'oob' === opts.callback_url) {
        this._setError(this.E_DESKTOP_CANNOT_AUTHENTICATE);
        return false;
    }
    else {
        return this._notImplementedYet();
    }
    // …
};

/**
 * Get the authorized OAuth token and OAuth token secret for saving
 *
 * Your application should save these to restore a authorized user.
 *
 * @return An object containing the oauth_token and oauth_token_secret tokens.
 */
TwitJS.prototype.getAuthTokens = function() {
    if(this._assertAuth()) {
        return {
            oauth_token: this.oauth_accessor.token,
            oauth_token_secret: this.oauth_accessor.tokenSecret
        };
    }
    else {
        return false;
    }
};

/**
 * Restore a previously authorized user using saved tokens
 */     
TwitJS.prototype.restoreAuthTokens = function(oauth_token, oauth_token_secret) {
    this.oauth_accessor.token = oauth_token;
    this.oauth_accessor.tokenSecret = oauth_token_secret;
    
    // @todo: hard check auth here?
    // can we do that if not verified yet?
    // take an extra param to do that?
};
 
/**
 * Exchange an OAuth request token for an OAuth access token
 *
 * @param oauth_verify The oauth_verify param returned from authorize callback, or oob pin. 
 * @param cb Callback function to call once the token has been returned.
 * @public
 */
TwitJS.prototype.authAccessToken = function(oauth_verifier, cb) {
    if('oob' === this.opts.callback_url && isNaN(parseInt(oauth_verifier))) {
        this._setError(this.E_OOB_PIN_NAN);
        cb(false);
        return;
    }
    var _this = this;
    this._oauthRequest(
        'oauth/access_token',
        'POST',
        [['oauth_verifier', oauth_verifier]],
        [],
        function(rsp) {
            if(false === rsp) {
                return cb(false);
            }
            else {
                var rsp = OAuth.decodeForm(rsp);
                // override the request tokens for access tokens:
                _this.oauth_accessor.token 
                    = OAuth.getParameter(rsp, 'oauth_token');
                _this.oauth_accessor.tokenSecret
                    = OAuth.getParameter(rsp, 'oauth_token_secret');
                    
                return cb({
                    user_id: OAuth.getParameter(rsp, 'user_id'),
                    screen_name: OAuth.getParameter(rsp, 'screen_name')
                });
            }
        }
    );
};
 
/** Section: User and Account */
    


/** Section: Timeline */

/**
 * <code>statuses/home_timeline</code>: The logged in user's main timeline view.
 *
 * @link http://dev.twitter.com/doc/get/statuses/home_timeline
 *
 * @param int opts.since_id
 * @param int opts.max_id
 * @param int opts.count
 * @param int opts.page
 * @param bool opts.trim_user
 * @param bool opts.include_rts Include native Retweets
 * @param bool opts.include_entities {link:http://dev.twitter.com/pages/tweet_entities}
 * @param function cb Callback to fire when data request is completed
 *
 * @return undefined
 * @public
 */
TwitJS.prototype.statusesHomeTimeline = function(opts, cb) {
    if(this._assertAuth()) {
        this._oauthRequest(
            '1/statuses/home_timeline.json',
            'GET',
            opts,
            [],
            cb);
    }
    else {
        cb(false);
    }
};

/**
 * <code>statuses/friends_timeline</code>: The logged in user's main timeline view.
 *
 * “This method is identical to statuses/home_timeline, except that this method
 * will only include retweets if the include_rts parameter is set. The RSS and
 * Atom responses will always include retweets as statuses prefixed with RT.”
 *
 * @link http://dev.twitter.com/doc/get/statuses/friends_timeline
 *
 * @param int opts.since_id
 * @param int opts.max_id
 * @param int opts.count
 * @param int opts.page
 * @param bool opts.trim_user
 * @param bool opts.include_rts Include native Retweets
 * @param bool opts.include_entities {link:http://dev.twitter.com/pages/tweet_entities}
 * @param function cb Callback to fire when data request is completed
 *
 * @return undefined
 * @public
 */
TwitJS.prototype.statusesFriendsTimeline = function(opts, cb) {
    if(this._assertAuth()) {
        this._oauthRequest(
            '1/statuses/friends_timeline.json',
            'GET',
            opts,
            [],
            cb);
    }
    else {
        cb(false);
    }
};

/**
 * <code>statuses/user_timeline</code>: A user's timeline view.
 *
 * @link http://dev.twitter.com/doc/get/statuses/user_timeline
 *
 * @param int opts.user_id
 * @param string opts.screen_name
 * @param int opts.since_id
 * @param int opts.max_id
 * @param int opts.count
 * @param int opts.page
 * @param bool opts.trim_user
 * @param bool opts.include_rts Include native Retweets
 * @param bool opts.include_entities {link:http://dev.twitter.com/pages/tweet_entities}
 * @param function cb Callback to fire when data request is completed
 *
 * @return undefined
 * @public
 */
TwitJS.prototype.statusesUserTimeline = function(opts, cb) {
    if(this._assertAuth()) {
        this._oauthRequest(
            '1/statuses/user_timeline.json',
            'GET',
            opts,
            [],
            cb);
    }
    else {
        cb(false);
    }
};

/**
 * <code>statuses/mentions</code>: A user's mentions view.
 *
 * @link http://dev.twitter.com/doc/get/statuses/user_mentions
 *
 * @param int  opts.since_id
 * @param int  opts.max_id
 * @param int  opts.count
 * @param int  opts.page
 * @param bool opts.trim_user
 * @param bool opts.include_rts Include native Retweets
 * @param bool opts.include_entities {link:http://dev.twitter.com/pages/tweet_entities}
 * @param function cb Callback to fire when data request is completed
 *
 * @return undefined
 * @public
 */
TwitJS.prototype.statusesMentions = function(opts, cb) {
    if(this._assertAuth()) {
        this._oauthRequest(
            '1/statuses/mentions.json',
            'GET',
            opts,
            [],
            cb);
    }
    else {
        cb(false);
    }
};

/**
 * <code>statuses/retweeted_by_me</code>: The authorized user's Retweets.
 *
 * @link http://dev.twitter.com/doc/get/statuses/retweeted_by_me
 *
 * @param int  opts.since_id
 * @param int  opts.max_id
 * @param int  opts.count
 * @param int  opts.page
 * @param bool opts.trim_user
 * @param bool opts.include_entities {link:http://dev.twitter.com/pages/tweet_entities}
 * @param function cb Callback to fire when data request is completed
 *
 * @return undefined
 * @public
 */
TwitJS.prototype.statusesRetweetedByUser = function(opts, cb) {
    if(this._assertAuth()) {
        this._oauthRequest(
            '1/statuses/retweeted_by_me.json',
            'GET',
            opts,
            [],
            cb);
    }
    else {
        cb(false);
    }
};

/**
 * <code>statuses/retweeted_to_me</code>: Retweets by authorized user's followees
 *
 * @link http://dev.twitter.com/doc/get/statuses/retweeted_to_me
 *
 * @param int  opts.since_id
 * @param int  opts.max_id
 * @param int  opts.count
 * @param int  opts.page
 * @param bool opts.trim_user
 * @param bool opts.include_entities {link:http://dev.twitter.com/pages/tweet_entities}
 * @param function cb Callback to fire when data request is completed
 *
 * @return undefined
 * @public
 */
TwitJS.prototype.statusesRetweetedToUser = function(opts, cb) {
    if(this._assertAuth()) {
        this._oauthRequest(
            '1/statuses/retweeted_to_me.json',
            'GET',
            opts,
            [],
            cb);
    }
    else {
        cb(false);
    }
};

/**
 * <code>statuses/retweeted_to_me</code>: Retweets by authorized user's followees
 *
 * @link http://dev.twitter.com/doc/get/statuses/retweets_of_me
 *
 * @param int  opts.since_id
 * @param int  opts.max_id
 * @param int  opts.count
 * @param int  opts.page
 * @param bool opts.trim_user
 * @param bool opts.include_entities {link:http://dev.twitter.com/pages/tweet_entities}
 * @param function cb Callback to fire when data request is completed
 *
 * @return undefined
 * @public
 */
TwitJS.prototype.statusesRetweetsOfUser = function(opts, cb) {
    if(this._assertAuth()) {
        this._oauthRequest(
            '1/statuses/retweets_of_me.json',
            'GET',
            opts,
            [],
            cb);
    }
    else {
        cb(false);
    }
};

/** Section: Statuses */

/**
 * <code>statuses/update</code>: Post a tweet
 *
 * @link http://dev.twitter.com/doc/get/statuses/update
 *
 * @param int    opts.in_reply_to_status_id The ID of an existing status that the update is in reply to.
 * @param float  opts.lat The latitude of the location this tweet refers to.
 * @param float  opts.long The longitude of the location this tweet refers to.
 * @param string opts.place_id A place in the world. IDs from <code>geo/reverse_geocode</code>.
 * @param bool   opts.display_coordinates Display location for this tweet
 * @param bool   opts.trim_user
 * @param bool   opts.include_entities {link:http://dev.twitter.com/pages/tweet_entities}
 * @param function cb Callback to fire when data request is completed
 *
 * @return undefined
 * @public
 */
TwitJS.prototype.statusesUpdate = function(message, opts, cb) {
    if(this._assertAuth()) {    
        opts = this._handleMethodOptions(opts);
        this._oauthRequest(
            '1/statuses/update.json',
            'POST',
            opts.concat([['status', message]]),
            [],
            cb
        );
    }
    else {
        cb(false);
    }
};

/**
 * <code>statuses/show</code>: Return a single tweet
 *
 * @link http://dev.twitter.com/doc/get/statuses/show
 *
 * @param string status_id Numerical ID of the tweet to return
 * @param bool   opts.trim_user
 * @param bool   opts.include_entities {link:http://dev.twitter.com/pages/tweet_entities}
 * @param function cb Callback to fire when data request is completed
 *
 * @return undefined
 * @public
 */
TwitJS.prototype.statusesShow = function(status_id, opts, cb) {
    if(this._assertAuth()) {    
        opts = this._handleMethodOptions(opts);
        this._oauthRequest(
            '1/statuses/show/'+status_id+'.json',
            'GET',
            opts.concat([['id', status_id]]),
            [],
            cb
        );
    }
    else {
        cb(false);
    }
};

/**
 * <code>statuses/destroy</code>: Delete a tweet
 *
 * @link http://dev.twitter.com/doc/get/statuses/destroy
 *
 * @param string status_id Numerical ID of the tweet to return
 * @param bool   opts.trim_user
 * @param bool   opts.include_entities {link:http://dev.twitter.com/pages/tweet_entities}
 * @param function cb Callback to fire when data request is completed
 *
 * @return undefined
 * @public
 */
TwitJS.prototype.statusesDestroy = function(status_id, opts, cb) {
    if(this._assertAuth()) {    
        opts = this._handleMethodOptions(opts);
        this._oauthRequest(
            '1/statuses/destroy/'+status_id+'.json',
            'POST',
            opts.concat([['id', status_id]]),
            [],
            cb
        );
    }
    else {
        cb(false);
    }
};

/**
 * <code>statuses/retweet</code>: Retweet a tweet
 *
 * @link http://dev.twitter.com/doc/get/statuses/retweet
 *
 * @param string status_id Numerical ID of the tweet to return
 * @param bool   opts.trim_user
 * @param bool   opts.include_entities {link:http://dev.twitter.com/pages/tweet_entities}
 * @param function cb Callback to fire when data request is completed
 *
 * @return undefined
 * @public
 */
TwitJS.prototype.statusesRetweet = function(status_id, opts, cb) {
    if(this._assertAuth()) {    
        opts = this._handleMethodOptions(opts);
        this._oauthRequest(
            '1/statuses/retweet/'+status_id+'.json',
            'POST',
            opts.concat([['id', status_id]]),
            [],
            cb
        );
    }
    else {
        cb(false);
    }
};

/**
 * <code>statuses/retweets</code>: Return retweets of a given tweet
 *
 * @link http://dev.twitter.com/doc/get/statuses/retweets
 *
 * @param string status_id Numerical ID of the retweeted tweet
 * @param int    opts.count Number of records to retrieve. Max: 100
 * @param bool   opts.trim_user
 * @param bool   opts.include_entities {link:http://dev.twitter.com/pages/tweet_entities}
 * @param function cb Callback to fire when data request is completed
 *
 * @return undefined
 * @public
 */
TwitJS.prototype.statusesRetweets = function(status_id, opts, cb) {
    if(this._assertAuth()) {    
        opts = this._handleMethodOptions(opts);
        this._oauthRequest(
            '1/statuses/retweets/'+status_id+'.json',
            'GET',
            opts.concat([['id', status_id]]),
            [],
            cb
        );
    }
    else {
        cb(false);
    }
};

/**
 * <code>statuses/retweeted_by</code>: Up to 100 members who retweeted the status.
  *
 * @link http://dev.twitter.com/doc/get/statuses/retweeted_by
 *
 * @param string status_id Numerical ID of the retweeted status
 * @param int    opts.count Number of records to retrieve. Max: 100
 * @param int    opts.page Specifies the page of results to retrieve.
 * @param bool   opts.trim_user
 * @param bool   opts.include_entities {link:http://dev.twitter.com/pages/tweet_entities}
 * @param function cb Callback to fire when data request is completed
 *
 * @return undefined
 * @public
 */
TwitJS.prototype.statusesRetweetedBy = function(status_id, opts, cb) {
    if(this._assertAuth()) {    
        opts = this._handleMethodOptions(opts);
        this._oauthRequest(
            '1/statuses/'+status_id+'/retweeted_by.json',
            'GET',
            opts.concat([['id', status_id]]),
            [],
            cb
        );
    }
    else {
        cb(false);
    }
};

/**
 * <code>statuses/retweeted_by</code>: Up to 100 user ids who retweeted a status.
  *
 * @link http://dev.twitter.com/doc/get/statuses/retweeted_by/ids
 *
 * @param string status_id Numerical ID of the retweeted status
 * @param int    opts.count Number of records to retrieve. Max: 100
 * @param int    opts.page Specifies the page of results to retrieve.
 * @param bool   opts.trim_user
 * @param bool   opts.include_entities {link:http://dev.twitter.com/pages/tweet_entities}
 * @param function cb Callback to fire when data request is completed
 *
 * @return undefined
 * @public
 */
TwitJS.prototype.statusesRetweetedByIds = function(status_id, opts, cb) {
    if(this._assertAuth()) {    
        opts = this._handleMethodOptions(opts);
        this._oauthRequest(
            '1/statuses/'+status_id+'/retweeted_by/ids.json',
            'GET',
            opts.concat([['id', status_id]]),
            [],
            cb
        );
    }
    else {
        cb(false);
    }
};

/** Section: Favorites */

/**
 * <code>favorites/create</code>: Favorite a Tweet
 *
 * @link http://dev.twitter.com/doc/get/favorites/create
 *
 * @param string status_id The ID of a Twitter status to add to favorites
 * @param bool opts.include_entities {link:http://dev.twitter.com/pages/tweet_entities}
 * @param function cb Callback to fire when data request is completed
 *
 * @return undefined
 * @public
 */
TwitJS.prototype.favoritesCreate = function(status_id, opts, cb) {
    if(this._assertAuth()) {    
        opts = this._handleMethodOptions(opts);
        this._oauthRequest(
            '1/favorites/create/'+status_id+'.json',
            'POST',
            opts.concat([['status_id', status_id]]),
            [],
            cb
        );
    }
    else {
        cb(false);
    }
};


/* Direct Messages */

/* Friends and Followers */

/* Spam & Blocking */

/* Lists */

/* Trends */

/* Search */

/* Geo */