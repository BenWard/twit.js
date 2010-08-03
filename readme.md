# Twit.js

Twit.js is a simple 1:1 wrapper around the [OAuth 1.0a Twitter API](http://dev.twitter.com/doc). More specifically, it's a higher-level abstraction of `oauth.js` and `XMLHttpRequest`, designed first to allow you interact with Twitter from browser-like environments (like the [Mac OSX dashboard](http://developer.apple.com/macosx/dashboard.html), or [Fluidium](http://fluidium.org/), and so on.)

Requires: `oauth.js` and `sha1.js` from <http://oauth.googlecode.com/svn/code/javascript/>

It's also the core wrapper that powers [Twitgit](http://twitgit.benapps.net).

## Usage

Here, we pass `twttr.log` as the callback function:

    twttr = new TwitJS(consumer_key, consumer_secret, { debug: true });
    twttr.getAuthorizationUrl(twttr.log);

Save you request tokens with `twttr.getAuthTokens()` and save them somewhere, then visit the authorization URL and return (either via `oauth_callback`, with an `oauth_verify` parameter, or manually with an `oob` pin.)

    twttr = new TwitJS(consumer_key, consumer_secret, { debug: true });
    twttr.restoreAuthTokens(request_token, request_token_secret);
    twttr.authAccessToken(oauth_verifier, twttr.log);

TwitJS will now have exchanged the request tokens for access tokens. call `twittr.getAuthTokens()` to save them away somewhere. Making calls for the user is easy enough:

    twttr.statusesHomeTimeline({count: 5}, twttr.log);

### Method Names

The idea is to map direct to Twitter's names, which currently means that method names are cumbersome. `/statuses/home_timeline` becomes 'statusesHomeTimeline()`. I'm not a fan, but I also don't want to create a whole new Twitter API vocabulary.

### JSON

The wrapper only deals in JSON, for obvious architectural reasons.

### Errors

If you get `false` passed to your callback, that means something went wrong. Call `twttr.getLastError()` and `twttr.getLastErrorMessage()` to find out what.

### Checking API Limits

After each request, the `twttr.api` object will be populated from the various `X-` headers that Twitter sends back with API limits and runtime info.

## Repurposing for other JavaScript environments

Although the shipping code is built for a browser-like world (specifically WebKit), you should be able to repurpose this for other JavaScript environments like YQL or Node by swapping `TwitJS.prototype.httpRequest()` for a compatible function using your framework/environment of choice.

    TwitJS.prototype.httpRequest = function(url, method, headers, body, callback) { […] }

Make the request, then pass the response http status code, headers, body and original callback to `TwitJS._handleHttpResponse(status, headers, body, callback)`.

This is entirely untested at this point. YMMV, and I may not have thought of everything required to make this portable outside WebKit.

## OAuth in Web Browsers

Note: Do remember that you should never, ever, _ever_ be handling application authorization for a web application on the client side. You must keep your application keys secure! **Twit.js is for use in JavaScript environments outside of the conventional browser**.

## License

Twit.js is made available to you under the New [BSD License](http://www.linfo.org/bsdlicense.html), which looks like this:

> Copyright 2010, [Ben Ward](http://benward.me)
>
> Redistribution and use in source and binary forms, with or without
> modification, are permitted provided that the following conditions are met:
>
> 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
> 2. Redistributions in binary form must reproduce the above copyright notice,
> this list of conditions and the following disclaimer in the documentation
> and/or other materials provided with the distribution.
> 3. Neither the name of TwitJS nor the names of its contributors
> may be used to endorse or promote products derived from this software
> without specific prior written permission.
>
> THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
> AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
> IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
> ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
> LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
> CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
> SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
> INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
> CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
> ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
> POSSIBILITY OF SUCH DAMAGE.
>
> If you reuse this code, you must maintain attribution to the original
> author(s) of this and any shared components.