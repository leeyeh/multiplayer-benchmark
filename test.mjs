import Play from "@leancloud/play";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";

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
};
const player1 = new Client({
  ...configs,
  userId: "player-1", // 设置用户 id
});
const player2 = new Client({
  ...configs,
  userId: "player-2", // 设置用户 id
});

await player1.connect();
await player2.connect();

const roomName = `test-room-${Date.now()}`;

await player1.joinOrCreateRoom(roomName);
await player2.joinOrCreateRoom(roomName);

player1.on(Event.CUSTOM_EVENT, ({ eventId, eventData, senderId }) => {
  player1.sendEvent(eventId, eventData, {
    targetActorIds: senderId,
  });
});

let i = 0;
let received = 0;
let totalTime = 0;
const ts = {};
player2.on(Event.CUSTOM_EVENT, ({ eventData }) => {
  if (ts[eventData.i]) {
    received++;
    const rtt = Date.now() - ts[eventData.i];
    totalTime += rtt;

    const lostRate = Math.floor((1 - received / eventData.i) * 10000) / 100;
    const meanRTT = Math.round(totalTime / received);
    console.log(
      `[${eventData.i}] RTT: ${rtt} LOST: ${lostRate}% MEAN RTT: ${meanRTT}`
    );

    delete ts[eventData.i];
  }
});
setInterval(() => {
  i++;
  ts[i] = Date.now();
  player2.sendEvent(
    0,
    { i },
    {
      targetActorIds: player1.player.actorId,
    }
  );
}, Math.round(1000 / argv.tickrate));
