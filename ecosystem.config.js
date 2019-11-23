module.exports = {
    apps : [{
      name: "server",
      script: "./server.js",
      cron_restart: "0 40 10 ? * *",
    }]
}