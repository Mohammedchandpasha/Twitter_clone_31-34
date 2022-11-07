const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const app = express();
let jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;
app.use(express.json());

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`Db error:${e.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();
//authenticateToken
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);

    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_KEY", async (error, payload) => {
      if (error) {
        response.status(401);

        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};
// Register API
app.post("/register/", async (request, response) => {
  const { username, name, password, gender } = request.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  const selectUserQuery = `
    SELECT * FROM user 
    WHERE username='${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createUserQuery = `INSERT INTO user(
            username,password,name,gender)
            VALUES (
               '${username}',
                '${hashedPassword}',
                '${name}',
                '${gender}'
                
                );`;
      await db.run(createUserQuery);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
   SELECT * FROM user
   WHERE username='${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser != undefined) {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_KEY");

      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

//API3 return the latest Tweets of people whom user follows
app.get("/user/following", authenticateToken, async (request, response) => {
  let { username } = request;

  const userIdQuery = `select user_id from user 
  where username='${username}';`;
  const userId = await db.get(userIdQuery);
  const id = userId.user_id;
  console.log(id);
  const followerQuery = ` select following_user_id from follower 
  where follower_user_id=${id};`;
  const followingIdsObArray = await db.all(followerQuery);
  console.log(followingIdsObArray);
  let followingIds = [];
  for (let ob of followingIdsObArray) {
    followingIds.push(ob.following_user_id);
  }
  let tweetList = [];
  for (let id of followingIds) {
    const tweetQuery = `select * from
      tweet where user_id=${id};`;
    const tweetsOb = await db.all(tweetQuery);
    const userNameQuery = `select name from user 
    where user_id=${id};`;
    let name = await db.get(userNameQuery);
    let ob = { name: name.name };
    tweetList.push(ob);
  }
  response.send(tweetList);
});
//follower names

app.get("/user/followers", authenticateToken, async (request, response) => {
  let { username } = request;

  const userIdQuery = `select user_id from user 
  where username='${username}';`;
  const userId = await db.get(userIdQuery);
  const id = userId.user_id;
  console.log(id);
  const followingQuery = ` select follower_user_id from follower 
  where following_user_id=${id};`;
  const followerIdsObArray = await db.all(followingQuery);
  console.log(followerIdsObArray);
  let followerIds = [];
  for (let ob of followerIdsObArray) {
    followerIds.push(ob.follower_user_id);
  }
  let tweetList = [];
  for (let id of followerIds) {
    const tweetQuery = `select * from
      tweet where user_id=${id};`;
    const tweetsOb = await db.all(tweetQuery);
    const userNameQuery = `select name from user 
    where user_id=${id};`;
    let name = await db.get(userNameQuery);
    let ob = { name: name.name };
    tweetList.push(ob);
  }
  response.send(tweetList);
});
//user following tweets API6
app.get("/tweets/:tweetId", authenticateToken, async (request, response) => {
  let { username } = request;
  const { tweetId } = request.params;

  const userIdQuery = `select user_id from user 
  where username='${username}';`;
  const userId = await db.get(userIdQuery);
  const id = userId.user_id;
  console.log(id);
  const followerQuery = ` select following_user_id from follower 
  where follower_user_id=${id};`;
  const followingIdsObArray = await db.all(followerQuery);
  console.log(followingIdsObArray);
  let followingIds = [];
  for (let ob of followingIdsObArray) {
    followingIds.push(ob.following_user_id);
  }
  console.log(followingIds);

  const getUseIdFromTweetIdQuery = `select user_id from tweet
  where tweet_id=${tweetId}`;
  const tweetUserId = await db.get(getUseIdFromTweetIdQuery);
  console.log(tweetUserId);
  if (followingIds.includes(tweetUserId.user_id)) {
    const repliesQuery = `select  count() as noOfReplies from  tweet inner  join 
      reply  on tweet.tweet_id=reply.tweet_id where tweet.tweet_id=${tweetId};`;
    const noOfReplies = await db.get(repliesQuery);
    const likesQuery = `select  count() as noOfLikes from  tweet inner  join 
      like  on tweet.tweet_id=like.tweet_id where tweet.tweet_id=${tweetId};`;
    const likesCount = await db.get(likesQuery);
    console.log(likesCount);
    const tweetDateTimeQuery = `select tweet,date_time from tweet where
    tweet_id=${tweetId}`;
    const tweetDateTime = await db.get(tweetDateTimeQuery);
    let ob = {
      tweet: tweetDateTime.tweet,
      likes: likesCount.noOfLikes,
      replies: noOfReplies.noOfReplies,
      dateTime: tweetDateTime.date_time,
    };
    console.log(ob);
    response.send(ob);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});
//API7

app.get(
  "/tweets/:tweetId/likes",
  authenticateToken,
  async (request, response) => {
    let { username } = request;
    const { tweetId } = request.params;

    const userIdQuery = `select user_id from user 
  where username='${username}';`;
    const userId = await db.get(userIdQuery);
    const id = userId.user_id;
    console.log(id);
    const followerQuery = ` select following_user_id from follower 
  where follower_user_id=${id};`;
    const followingIdsObArray = await db.all(followerQuery);
    console.log(followingIdsObArray);
    let followingIds = [];
    for (let ob of followingIdsObArray) {
      followingIds.push(ob.following_user_id);
    }
    console.log(followingIds);

    const getUseIdFromTweetIdQuery = `select user_id from tweet
  where tweet_id=${tweetId}`;
    const tweetUserId = await db.get(getUseIdFromTweetIdQuery);
    console.log(tweetUserId);
    if (followingIds.includes(tweetUserId.user_id)) {
      const repliesQuery = `select  count() as noOfReplies from  tweet inner  join 
      reply  on tweet.tweet_id=reply.tweet_id where tweet.tweet_id=${tweetId};`;
      const noOfReplies = await db.get(repliesQuery);
      const likesQuery = `select  * from  tweet inner  join 
      like  on tweet.tweet_id=like.tweet_id where tweet.tweet_id=${tweetId};`;
      const likesObArray = await db.all(likesQuery);
      console.log(likesObArray);
      let likedUsernames = [];
      for (let ob of likesObArray) {
        const likedUsernameQuery = `select username from user
       where user_id=${ob.user_id};`;
        let likedUsername = await db.get(likedUsernameQuery);
        likedUsernames.push(likedUsername.username);
      }
      let ob = { likes: likedUsernames };
      response.send(ob);
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
//API 8
app.get(
  "/tweets/:tweetId/replies",
  authenticateToken,
  async (request, response) => {
    let { username } = request;
    const { tweetId } = request.params;

    const userIdQuery = `select user_id from user 
  where username='${username}';`;
    const userId = await db.get(userIdQuery);
    const id = userId.user_id;
    console.log(id);
    const followerQuery = ` select following_user_id from follower 
  where follower_user_id=${id};`;
    const followingIdsObArray = await db.all(followerQuery);
    console.log(followingIdsObArray);
    let followingIds = [];
    for (let ob of followingIdsObArray) {
      followingIds.push(ob.following_user_id);
    }
    console.log(followingIds);

    const getUseIdFromTweetIdQuery = `select user_id from tweet
  where tweet_id=${tweetId}`;
    const tweetUserId = await db.get(getUseIdFromTweetIdQuery);
    console.log(tweetUserId);
    if (followingIds.includes(tweetUserId.user_id)) {
      const repliesQuery = `select  * from  tweet inner  join 
      reply  on tweet.tweet_id=reply.tweet_id where tweet.tweet_id=${tweetId};`;

      const repliesObArray = await db.all(repliesQuery);
      let repliesList = [];

      for (let ob of repliesObArray) {
        let re = { user_id: ob.user_id, reply: ob.reply };
        repliesList.push(re);
      }
      let resultList = [];
      for (let o of repliesList) {
        const replierNameQuey = `select name from user where user_id=${o.user_id};`;
        const replierName = await db.get(replierNameQuey);
        console.log(replierName);
        let rep = {
          name: replierName.name,
          reply: o.reply,
        };
        resultList.push(rep);
      }

      response.send({ replies: resultList });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//API 9
app.get("/user/tweets", authenticateToken, async (request, response) => {
  let { username } = request;

  const userIdQuery = `select user_id from user 
  where username='${username}';`;
  const userId = await db.get(userIdQuery);
  const id = userId.user_id;

  const getTweetIdsQuery = `select tweet_id from tweet
  where user_id=${id};`;
  const tweetIds = await db.all(getTweetIdsQuery);
  let obList = [];
  for (let ob of tweetIds) {
    const likesQuery = ` select count() as likesCount from like where 
     tweet_id=${ob.tweet_id};`;
    const likes = await db.get(likesQuery);
    const repliesQuery = ` select count() as repliesCount from reply where
    tweet_id=${ob.tweet_id};`;
    const replies = await db.get(repliesQuery);
    const tweetDateTimeQuery = `select tweet,date_time as dateTime  from tweet
    where tweet_id=${ob.tweet_id};`;
    const tweetDateTime = await db.get(tweetDateTimeQuery);

    let responseObject = {
      tweet: tweetDateTime.tweet,
      likes: likes.likesCount,
      replies: replies.repliesCount,
      dateTime: tweetDateTime.dateTime,
    };
    obList.push(responseObject);
  }
  response.send(obList);
});

//API 10 create Tweet

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  let { username } = request;

  const { tweet } = request.body;
  console.log(username);

  const userIdQuery = `select user_id from user 
  where username='${username}';`;
  const userId = await db.get(userIdQuery);
  console.log(userId);
  const id = userId.user_id;
  const d = new Date();
  console.log(d);
  let y = d.getFullYear();
  let mo = d.getMonth();
  let da = d.getDate();
  let h = d.getHours();
  let m = d.getMinutes();
  let s = d.getSeconds();
  const e = [y, mo, da].join("-");
  const f = [h, m, s].join(":");
  const g = [e, f].join(" ");

  const postTweetQuery = `Insert into tweet(tweet,user_id,date_time)
  values(
      
     ' ${tweet}',
     ${id},
     '${g}'
     );`;

  await db.run(postTweetQuery);
  response.send("Created a Tweet");
});

//API 11
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    let { username } = request;
    let { tweetId } = request.params;

    const userIdQuery = `select user_id from user 
  where username='${username}';`;
    const userId = await db.get(userIdQuery);
    const id = userId.user_id;

    const getTweetIdsQuery = `select tweet_id from tweet
  where user_id=${id};`;
    const tweetIds = await db.all(getTweetIdsQuery);
    let tweetIdsArray = [];
    for (let ob of tweetIds) {
      tweetIdsArray.push(ob.tweet_id);
    }

    tweetId = parseInt(tweetId);
    if (tweetIdsArray.includes(tweetId)) {
      console.log("yes");
      const deleteQuery = `delete from tweet where 
        tweet_id=${tweetId}`;
      await db.run(deleteQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;
