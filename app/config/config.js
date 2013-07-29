
module.exports = function(app, express) {

    var config = this;


    var allowCrossDomain = function(req, res, next) {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

        // intercept OPTIONS method
        if ('OPTIONS' == req.method) {
          res.send(200);
        }
        else {
          next();
        }
    };


    // General Config
    app.configure(function() {

        app.set('port', 8443);
        
        app.locals.pretty = true;

        app.use(express.logger('dev'));
        app.use(express.bodyParser());
        app.use(allowCrossDomain);
        app.use(express.cookieParser());
        app.use(express.session({ secret: 'super-duper-secret-secret' }));
        app.use(express.methodOverride());
    });


    // Environment Specific Config
    app.configure('development', function() {
        app.use(express.errorHandler());
    });


    // Server / SSL
    var fs = require('fs');
    app.sslOptions = {
        key:  fs.readFileSync(__dirname + '/vdjserver.org.certificate/vdjserver.org.key'),
        cert: fs.readFileSync(__dirname + '/vdjserver.org.certificate/vdjserver.org.cer')
    };


    return config;
};
