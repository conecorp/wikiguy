const express = require('express');
const app = express();
const PORT = process.env.PORT || 0000;

app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Orbital is orbiting</title>
        <style>
@import url('https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap');

          body { font-family: "Montserrat", "Arial", sans-serif; text-align: center; padding: 50px; background: #222222; color: white }
          h1 { color: #ff6600; }
        </style>
      </head>
      <body>
        <h1>Orbital Discord Bot</h1>
        <p>Bot is running.</p>
      </body>
    </html>
  `);
});

app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    bot: 'Orbital Discord Bot',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Web server running on port ${PORT}`);
});

module.exports = app;
