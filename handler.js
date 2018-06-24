"use strict";

const Chromeless = require("chromeless").default;
const request = require("request");

module.exports.main = async function(event, context, callback) {
  const chromeless = new Chromeless({
    remote: !!process.env.CHROMELESS_ENDPOINT_URL,
    debug: true
  });

  await chromeless.goto(
    `https://www.google.co.jp/maps/dir/${encodeURIComponent(
      process.env.START_STATION
    )}/${encodeURIComponent(process.env.END_STATION)}`
  );
  await chromeless.wait(".directions-travel-mode-selector");
  await chromeless.evaluate(() => {
    document.querySelector('[aria-label="公共交通機関"]').parentElement.click();
  });
  await chromeless.wait(".section-schedule-explorer");

  const trainInfo = await chromeless.evaluate(() => {
    const element = document.querySelector("#section-directions-trip-0");
    const rosen = element
      .querySelector(".section-directions-trip-renderable-summary")
      .querySelector('[style*="background-color"]');
    const [time, station] = element
      .querySelector(".section-directions-trip-secondary-text")
      .innerText.split("、");
    return {
      url: location.href,
      color:
        "#" +
        rosen.style.backgroundColor
          .match(/(\d+)/g)
          .map(n => `0${parseInt(n, 10).toString(16)}`.slice(-2))
          .join(""),
      train: rosen.innerText,
      station: station.replace("駅発", "駅"),
      time
    };
  });

  await chromeless.end();

  request(
    {
      method: "POST",
      url: process.env.SLACK_WEBHOOK,
      body: JSON.stringify({
        text: `<@${process.env.OWNER_ID}>`,
        attachments: [
          {
            fallback: trainInfo.message,
            color: trainInfo.color,
            title: "帰りの電車情報",
            title_link: trainInfo.url,
            text: trainInfo.message,
            fields: [
              {
                title: "乗車時刻",
                value: trainInfo.time,
                short: true
              },
              {
                title: "乗車駅",
                value: `${trainInfo.train} ${trainInfo.station}`,
                short: true
              }
            ]
          }
        ]
      })
    },
    (error, response, body) => {
      console.log(error, response, body);
      if (error) {
        context.done(true, error);
        return;
      }
      context.done(null, body);
    }
  );
};
