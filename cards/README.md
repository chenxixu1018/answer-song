# 答案之书卡片配置说明

只需要改 `cards/cards.js`。

每张卡只配置 5 个字段：

```js
{
  cardImage: "./cards/card.jpg",
  cardName: "【SSR】 - 后来的我们",
  songCover: "./cards/cover.jpg",
  lyric: "只期待后来的你能快乐，那就是后来的我最想的",
  songInfo: "《后来的我们》 五月天"
}
```

字段含义：

- `cardImage`：这个卡的卡面图片路径。
- `cardName`：这个卡的名字。
- `songCover`：这首歌的封面图片路径。
- `lyric`：推荐出来的歌词。
- `songInfo`：这句歌词所属的歌曲名称加作者。

图片放在 `cards` 文件夹里，然后写相对路径，例如：

```js
cardImage: "./cards/hou-lai-card.jpg",
songCover: "./cards/hou-lai-cover.jpg"
```

如果暂时没有图片，可以先填空字符串：

```js
cardImage: "",
songCover: ""
```

抽卡会从 `window.ANSWER_BOOK_CARDS` 数组里随机抽取一张。
