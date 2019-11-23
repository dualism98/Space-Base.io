module.exports = {
    apps : [{
      name: "server",
      script: "./server.js",
      cron_restart: "0 0 * * 1,3,5",
    }]
}