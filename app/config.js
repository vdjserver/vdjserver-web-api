
module.exports = function(app, express, mongoose) {

    var config = this;

    // General Config
    app.configure(function() {

        app.set('view engine', 'jade');
        app.set('views', __dirname + '/public/views');
        app.set('port', 8443);

        app.locals.pretty = true;
    //  app.use(express.favicon());
        app.use(express.logger('dev'));
        app.use(express.bodyParser());
        app.use(express.cookieParser());
        app.use(express.session({ secret: 'super-duper-secret-secret' }));
        app.use(express.methodOverride());
        app.use(require('stylus').middleware({ src: __dirname + '/public' }));
        app.use(express.static(__dirname + '/public'));
    });


    // Environment Specific Config
    app.configure('development', function() {
        app.use(express.errorHandler());
        mongoose.connect('mongodb://localhost:27017/vdjserver-accounts');
    });


    // Server / SSL
    var fs = require('fs');
    app.sslOptions = {
        key:  fs.readFileSync(__dirname + '/vendor/vdjserver.org.certificate/vdjserver.org.key'),
        cert: fs.readFileSync(__dirname + '/vendor/vdjserver.org.certificate/vdjserver.org.cer')
    };


    // Email Settings
    app.emailSettings = {
        user        : '',
        password    : '',
        sender      : 'VDJServer',
        host        : '',
        ssl         : true,
        port        : 123
    };


    return config;
};
