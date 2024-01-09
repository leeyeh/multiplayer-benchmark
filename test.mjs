import Play from "@leancloud/play";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { stdev, percentile } from "stats-lite";
import Histogram from "histogram-simple";

// 使用 yargs 解析命令行参数
const argv = yargs(hideBin(process.argv)).option("tickrate", {
  describe: "Set the tick rate",
  type: "number",
  default: 30,
}).argv;

const { Client, Event } = Play;

const configs = {
  appId: "OgE8zDRpOXNwsl3i38vccFqy-9Nh9j0Va", // 游戏的 Client ID
  appKey: "TMkbH8yfIO2APRioG2joeety", // 游戏的 Client Token
  playServer: "https://oge8zdrp.lc-cn-n1-shared.com", // 游戏的 API 域名
  gameVersion: "0.0.1", // 设置游戏版本号，选填，默认 0.0.1，不同版本的玩家不会匹配到同一个房间
  // ssl: false,
};
const player1 = new Client({
  ...configs,
  userId: "player-1", // 设置用户 id
});
const player2 = new Client({
  ...configs,
  userId: "player-2", // 设置用户 id
});

await Promise.all([player1.connect(), player2.connect()]);

const roomName = `test-room-${Date.now()}`;

await player1.joinOrCreateRoom(roomName);
await player2.joinOrCreateRoom(roomName);

player1.on(Event.CUSTOM_EVENT, ({ eventId, eventData, senderId }) => {
  player1.sendEvent(eventId, eventData, {
    targetActorIds: senderId,
  });
});

const MAX_COUNT = 2500;

let i = 0;
const RTTs = [];
let received = 0;
let totalTime = 0;
const ts = {};
player2.on(Event.CUSTOM_EVENT, ({ eventData }) => {
  if (ts[eventData.i]) {
    const rtt = (now() - ts[eventData.i]) / 1000;
    RTTs.push(rtt);

    const lossRate = Math.floor((1 - RTTs.length / eventData.i) * 10000) / 100;
    process.stdout.write(
      `[${eventData.i}/${MAX_COUNT}] RTT: ${rtt} LOST: ${lossRate}%\r`
    );

    delete ts[eventData.i];

    if (eventData.i === MAX_COUNT) {
      console.log(
        `RTT P99/95/75/50: ${[99, 95, 75, 50].map((percent) =>
          percentile(RTTs, percent / 100)
        )} stddev: ${stdev(RTTs)}`
      );
      const histogram = Histogram(
        RTTs.sort((a, b) => a - b).slice(0, Math.floor(0.96 * RTTs.length)),
        20
      );
      console.log(
        `RTT histogram: `,
        histogram.resultCounts,
        `
${histogram.toString(100)}`
      );
      console.log(
        "0-999:",
        JSON.stringify(
          Object.values(Histogram(RTTs, 1000, 0, 1000).resultCounts)
        )
      );

      console.log(`LOSS: ${lossRate}%`);
      process.exit(0);
    }
  }
});

const intervalId = setInterval(() => {
  if (i >= MAX_COUNT) {
    return clearInterval(intervalId);
  }
  i++;
  ts[i] = now();
  player2.sendEvent(
    0,
    { i },
    {
      targetActorIds: player1.player.actorId,
    }
  );
}, Math.round(1000 / argv.tickrate));

const now = () => {
  const hrTime = process.hrtime();
  return hrTime[0] * 1000000 + Math.round(hrTime[1] / 1000);
};
