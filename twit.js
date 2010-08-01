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
 * Neither the name of the <ORGANIZATION> nor the names of its contributors 
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
 * @param int options.api_version The Twitter API version to interact with. Default: 1
 * @param string options.user_agent The HTTP user agent of your application.
 *  Defaults to "Twit.js/vX.X"
 * @param bool options.debug Enable debug logging within the object
 * @param function options.logging_function A custom function to handle log messages.
 *  Defaults to <code>console.log()</code> where available, else <code>alert()</code>
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
    this.opts.api_verson = options.api_version || 1;
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
        // Twit.js requires an OAuth library.
        // See http://oauth.googlecode.com/svn/code/javascript/
        this.log("OAuth object is missing. You must include oauth.js for Twit.js to function.");
        return false;
    }

    if("undefined" === typeof(b64_hmac_sha1)) {
        // The OAuth library requires SHA-1.
        // See http://pajhome.org.uk/crypt/md5
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
TwitJS.prototype.E_HTTP_404             = 1;
TwitJS.prototype.E_HTTP_500             = 2;
TwitJS.prototype.E_HTTP_401             = 4;
TwitJS.prototype.E_HTTP_UNKNOWN         = 8; // Some other, unexpected HTTP error
TwitJS.prototype.E_INVALID_METHOD       = 16;
TwitJS.prototype.E_ERRONEOUS_ERROR      = 32; // Internal error. Tried to set a non-int error code.
TwitJS.prototype.E_AUTH_REQUIRED        = 64; // This method requires authorization.
TwitJS.prototype.E_NOT_IMPLEMENTED_YET  = 128; // Method is TODO
/** Meta */
TwitJS.prototype.meta = {};
TwitJS.prototype.meta.name = "Twit.js";
TwitJS.prototype.meta.version = "v0.1";

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
 * @returns string|bool The response text of a request (or bool:true) when
 *   successful, or false if the request fails.
 *
 * @see getLastError()
 * @public
 */
TwitJS.prototype.httpRequest = function(url, method, headers, body, callback) {
    
    var xhr = new XmlHttpRequest();
    xhr.onreadystatechange = function() {
        if(4 === xht.readyState) {
            if(200 === xht.status) {
                var rsp = xht.responseText;
                
                // return 'true' for empty responses
                if('' === rsp) {
                    rsp = true;
                }
                callback(rsp);
            }
            else if(404 === xht.status) {
                this.setError(this.E_HTTP_404);
                callback(false);
            }
            else if(401 === xht.status) {
                this.setError(this.E_HTTP_401);
                callback(false);
            }
            else if(500 <= xht.status) {
                this.setError(this.E_HTTP_500);
                callback(false);
            }
            else {
                this.setError(this.E_HTTP_UNKNOWN);
                callback(false);
            }
        }
    };
    // open the request
    xhr.open(method, url);
    xhr.setRequestHeader("User Agent", opts.user_agent);
    
    // set method headers
    if('object' === typeof(headers) && (headers instanceof Array)) {
        for(i=0; h = headers[i]; i++) {
            if(2 === h.length) {
                xhr.setRequestHeader(h[0], h[1]);
            }
            else {
                this.log("Invalid HTTP Request Header. Expected 2 parts, got " + h.length + ":");
                this.log(h);
            }
        }
    }
    
    // send the payload
    if(undefined !== body && null !== body && '' !== body) {
        xhr.send(body);
    }
    else {
        xhr.send();
    }
};

/**
 * Make a signed OAuth request
 *
 * @uses TwitJS.prototype.httpRequest()
 */
TwitJS.prototype._oauthRequest = function(url, method, params, headers, callback) {

    if(undefined === params) {
        params = [];
    }
    
    if(!('object' === typeof(headers) && (headers instanceof Array))) {
        headers = [];
    }
    
    var message = {
        method: method,
        action: url,
        parameters: params
    };
    OAuth.completeRequest(message, oauth_accessor);

    this.httpRequest(
     message.action,
     message.method,
     headers.concat(
         [['Authorization', OAuth.getAuthorizationHeader("", message.parameters)],
          ['Content-Type', 'application/x-www-form-urlencoded']]   
     ),
     OAuth.formEncode(message.parameters),
     callback
    );
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
 * Set the error code for the last error that occured in the system.
 *
 * Checks that you've set an integer, and sets the going-to-make-you-stab
 * -yourself E_ERRONEOUS_ERROR as the error if it's not. Oh, how you'll
 * laugh.
 *
 * @private
 * @return void
 */
TwitJS.prototype._setError = function(err) {
    if(undefined === err || isNaN(parseInt(err))) {
        this.log("Tried to set an error code that was invalid: " + err);
        this._setError(this.E_ERRONEOUS_ERROR);
    }
    else {
        this._lastError = err;
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
 * Immediately return an error if auth is required for a method
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
 * @return false
 * @private
 */
TwitJS.prototype._notImplementedYet = function() {
    this._setError(this.E_NOT_IMPLEMENTED_YET);
    return false;
};

/* Section: Authorization */

/**
 * Is the user authenticated and keys exchanged such that we can act on
 *   their behalf?
 * @return bool
 * @public
 * @todo Not Implemented Yet
 */
TwitJS.prototype.isAuthed = function() {
     return false;
 };

/** 
 * Get a request token, before requesting user authorization
 * @param cb Callback function to call once the token has been returned.
 * @private 
 */
TwitJS.prototype._authRequestToken = function(cb) {
    this._oauthRequest(
        this._getApiMethodUrl('oauth/request_token'),
        'post',
        [],
        [],
        cb
    );
};

/**
 * Exchange an OAuth request token for an OAuth access token
 * @param cb Callback function to call once the token has been returned.
 * @private
 */
TwitJS.prototype._authAccessToken = function(cb) {
    
};

/**
 * To access protected resources, the user must be authorized:
 *
 * Will obtain a request token, and then generate a URL to proceed with auth
 *
 * @return A URL to redirect the user to; requesting authorization for the app
 */
TwitJS.prototype.getAuthorizationUrl = function(cb) {
    this._authRequestToken(function(rsp) {
        
        if(false === rsp) {
            return cb(false);
        }
        else {
            var rsp = OAuth.decodeForm(rsp);
            return cb(
                get_api_method_url('oauth/authorize') 
                + "?oauth_token="
                + OAuth.getParameter(results, "oauth_token")
            );
        }
    });
};

/**
 * Authenticate using ‘Connect with Twitter’. Only available for web apps.
 * @return A URL to redirect the user to; requesting authentication for the app
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
 * Restore a previously authorized user using saved tokens
 */     
TwitJS.prototype.restoreAuth = function(oauth_token, oauth_token_secret, cb) {
    return this._notImplementedYet();
};

/**
 * Get the authorized OAuth token and OAuth token secret for saving
 */
TwitJS.prototype.getAuthTokens = function() {
    
};
 
/* User and Account */

/* Timeline */

/* Statuses */

/* Direct Messages */

/* Friends and Followers */

/* Spam & Blocking */

/* Lists */

/* Trends */

/* Search */

/* Geo */