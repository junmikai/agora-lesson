// 設定に追加されるHTML要素
var resolutions = [
  {
    name: "default",
    value: "default",
  },
  {
    name: "480p",
    value: "480p",
  },
  {
    name: "720p",
    value: "720p",
  },
  {
    name: "1080p",
    value: "1080p"
  }
]
// フラッシュ
function Toastify(options) {
  M.toast({ html: options.text, classes: options.classes })
}
// フラッシュ
var Toast = {
  info: (msg) => {
    Toastify({
      text: msg,
      classes: "info-toast"
    })
  },
  notice: (msg) => {
    Toastify({
      text: msg,
      classes: "notice-toast"
    })
  },
  error: (msg) => {
    Toastify({
      text: msg,
      classes: "error-toast"
    })
  }
}
// appIDとchannelの値が存在しているか確認する
function validator(formData, fields) {
  // フォームの各種キーを取得
  var keys = Object.keys(formData)
  for (let key of keys) {
    // 入力フォームの内fields(appID,channel)だけif文発動
    if (fields.indexOf(key) != -1) {
      // appIDとchannelの値が存在していない場合"key"を入力してくださいとエラーが出る
      if (!formData[key]) {
        Toast.error(key + "を入力してください ");
        return false;
      }
    }
  }
  return true
}

function serializeformData() {
  // 入力フォームの内nameとvalueを、JSONキーとvalueの形式にします
  var formData = $("#form").serializeArray();
  var obj = {};
  for (var item of formData) {
    // nameとvalueを、それぞれ変数keyとvalに収納します
    var key = item.name;
    var val = item.value;
    //objに各入力フォームをname:valという形で収納します
    obj[key] = val;
  }
  return obj;
}
// id = remoteStream.getId();
function addView(id, show) {
  if (!$("#" + id)[0]) {
    $("<div/>", {
      id: "remote_video_panel_" + id,
      class: "video-view",
    }).appendTo("#video")

    $("<div/>", {
      id: "remote_video_" + id,
      class: "video-placeholder",
    }).appendTo("#remote_video_panel_" + id)

    $("<div/>", {
      id: "remote_video_info_" + id,
      class: "video-profile " + (show ? "" : "hide"),
    }).appendTo("#remote_video_panel_" + id)

    $("<div/>", {
      id: "video_autoplay_" + id,
      class: "autoplay-fallback hide",
    }).appendTo("#remote_video_panel_" + id)
  }
}
function removeView(id) {
  if ($("#remote_video_panel_" + id)[0]) {
    $("#remote_video_panel_" + id).remove()
  }
}

// 1-5:配列videosとaudiosを持ってgetDevicesを発動させる
function getDevices(next) {
  // 1-1:各種デバイスを取得
  AgoraRTC.getDevices(function (items) {
    // 1-2:マイクとスピーカーだけを取得 → その後name、value、kindを追加する
    items
      .filter(function (item) {
        return ["audioinput", "videoinput"].indexOf(item.kind) !== -1;
      })
      .map(function (item) {
        return {
          name: item.label,
          value: item.deviceId,
          kind: item.kind,
        };
      });
    var videos = [];
    var audios = [];
    // 1-3:全てのデバイス情報を配列videosかaudiosに追加する
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if ("videoinput" == item.kind) {
        var name = item.label;
        var value = item.deviceId;
        // 1-3※:nameが存在しない場合下記の名前を追加する
        if (!name) {
          name = "camera-" + videos.length;
        }
        videos.push({
          name: name,
          value: value,
          kind: item.kind,
        });
      }
      if ("audioinput" == item.kind) {
        var name = item.label;
        var value = item.deviceId;
        if (!name) {
          name = "microphone-" + audios.length;
        }
        audios.push({
          name: name,
          value: value,
          kind: item.kind,
        });
      }
    }
    // 1-4:getDevicesの引数を準備
    next({ videos: videos, audios: audios });
  })
}

var rtc = {
  client: null,
  joined: false,
  published: false,
  localStream: null,
  remoteStreams: [],
  params: {}
}

function handleEvents(rtc) {
  // リモートが離れた時発動
  rtc.client.on("peer-leave", function (evt) {
    var id = evt.uid;
    // 変数 streamsはremoteStreamsの配列を空にする
    let streams = rtc.remoteStreams.filter((e) => id !== e.getId());
    // 変数 peerStreamは現在のIDのリモート
    let peerStream = rtc.remoteStreams.find((e) => id === e.getId());
    // リモートの配信を停止させる
    if (peerStream && peerStream.isPlaying()) {
      peerStream.stop();
    }
    // 配信情報のリモートの配列を空にする
    rtc.remoteStreams = streams;
    if (id !== rtc.params.uid) {
      removeView(id);
    }
    Toast.notice("peer leave");
  });
  // ローカルストリームが公開されたときに発生します。
  rtc.client.on("stream-published", function (evt) {
    Toast.notice("stream published success");
  });
  // リモートストリームが追加されたときに発生します。(=他のユーザーが既にチャネルにいる場合、こちらを参照する。)
  rtc.client.on("stream-added", function (evt) {
    var remoteStream = evt.stream;
    var id = remoteStream.getId();
    Toast.info("stream-added uid: " + id);
    if (id !== rtc.params.uid) {
      rtc.client.subscribe(remoteStream, function (err) {});
    }
  });
  // リモートビデオをHTMLに追加し、再生を始めます
  rtc.client.on("stream-subscribed", function (evt) {
    var remoteStream = evt.stream;
    var id = remoteStream.getId();
    rtc.remoteStreams.push(remoteStream);
    addView(id);
    remoteStream.play("remote_video_" + id);
    Toast.info("stream-subscribed remote-uid: " + id);
  });
  // リモートストリームが削除されたときに発生します。
  rtc.client.on("stream-removed", function (evt) {
    var remoteStream = evt.stream;
    var id = remoteStream.getId();
    Toast.info("stream-removed uid: " + id);
    if (remoteStream.isPlaying()) {
      remoteStream.stop();
    }
    rtc.remoteStreams = rtc.remoteStreams.filter(function (stream) {
      return stream.getId() !== id;
    });
    removeView(id);
  });
  rtc.client.on("onTokenPrivilegeWillExpire", function () {
    // After requesting a new token
    // rtc.client.renewToken(token);
    Toast.info("onTokenPrivilegeWillExpire");
  });
  rtc.client.on("onTokenPrivilegeDidExpire", function () {
    // After requesting a new token
    // client.renewToken(token);
    Toast.info("onTokenPrivilegeDidExpire");
  });
}
// 呼び出し元 → join(rtc, params); つまり[option = params = formの中身]
// params = serializeformData();
// serializeformData() = $("#form").serializeArray();
function join(rtc, option) {
  console.log(rtc)
  // もし入室済みの場合はエラーを返す
  if (rtc.joined) {
    Toast.error("参加済みです");
    return;
  }
  // rtc.client = クライアント(受ける人)を作成。この時モードとコーデックを設定する
  rtc.client = AgoraRTC.createClient({
    mode: option.mode,
    codec: option.codec,
  });
  rtc.params = option;
  // 各種ボタンを押した時の処理
  handleEvents(rtc);
  // rtc.client = 配信情報のセットアップ
  rtc.client.init(
    option.appID,
    // appIDが正しい場合チャンネルに参加する
    function () {
      rtc.client.join(
        option.token ? option.token : null,
        option.channel,
        option.uid ? +option.uid : null,
        // セットアップの参加した時の処理
        function (uid) {
          Toast.notice(
            "join channel: " + option.channel + " success, uid: " + uid
          );
          rtc.joined = true;
          rtc.params.uid = uid;

          // ストリームオブジェクトを作成(まだ再生されない)
          rtc.localStream = AgoraRTC.createStream({
            streamID: rtc.params.uid,
            audio: true,
            video: true,
            screen: false,
            microphoneId: option.microphoneId,
            cameraId: option.cameraId,
          });
          // ローカルストリームをセットアップ
          rtc.localStream.init(
            // 初期化に成功した時
            function () {
              // HTML要素ID「local_stream」で配信を再生します
              rtc.localStream.play("local_stream");
              // ローカルストリームを公開する
              publish(rtc);
            },
            // 初期化に失敗した時
            function (err) {
              Toast.error(
                "ストリームの初期化に失敗しました。コンソールを開いてください"
              );
              console.error("ローカルストリームの初期化に失敗しました", err);
            }
          );
        },
        // チャンネルの参加に失敗した時(誤ったappidを入力した時)
        function (err) {
          Toast.error(
            "クライアントの参加に失敗しました。コンソールを開いて詳細を参照してください"
          );
          console.error("クライアントの参加に失敗しました", err);
        }
      );
    },
    (err) => {
      Toast.error(
        "クライアントの初期化に失敗しました。コンソールを開いて詳細を参照してください"
      );
      console.error(err);
    }
  );
}




function publish(rtc) {
  if (!rtc.client) {
    Toast.error("最初に部屋に参加してください");
    return;
  }
  if (rtc.published) {
    Toast.error("あなたの公開済み");
    return;
  }
  var oldState = rtc.published;

  // localStreamを公開する
  rtc.client.publish(rtc.localStream, function (err) {
    rtc.published = oldState;
    Toast.error("公開できませんでした");
    console.error(err);
  });
  Toast.info("公開しました");
  rtc.published = true;
}
// localStreamを非公開する
function unpublish(rtc) {
  if (!rtc.client) {
    Toast.error("最初に部屋に参加してください");
    return
  }
  if (!rtc.published) {
    Toast.error("あなたは公開しませんでした");
    return
  }
  var oldState = rtc.published
  rtc.client.unpublish(rtc.localStream, function (err) {
    rtc.published = oldState
    Toast.error("非公開に失敗しました");
    console.error(err)
  })
  Toast.info("非公開にしました");
  rtc.published = false
}

function leave(rtc) {
  if (!rtc.client) {
    Toast.error("最初に部屋に参加してください");
    return;
  }
  if (!rtc.joined) {
    Toast.error("チャンネルにいません");
    return;
  }
  // AgoraRTCチャネルを離れます。このメソッドは、ユーザーがチャンネルを離れることを可能にします。
  rtc.client.leave(
    function () {
      // ストリームの再生を停止します
      if (rtc.localStream.isPlaying()) {
        rtc.localStream.stop();
      }
      // ストリームを閉じます
      rtc.localStream.close();
      // 残りのリモートの配信を順番に停止させる
      for (let i = 0; i < rtc.remoteStreams.length; i++) {
        var stream = rtc.remoteStreams.shift();
        var id = stream.getId();
        if (stream.isPlaying()) {
          stream.stop();
        }
        // 対象のHTMLを削除する
        removeView(id);
      }
      // ビデオの情報全て初期化する
      rtc.localStream = null;
      rtc.remoteStreams = [];
      rtc.client = null;
      rtc.published = false;
      rtc.joined = false;
      Toast.notice("退室成功しました");
    },
    function (err) {
      Toast.error("退室成功しました");
      console.error(err);
    }
  );
}

// ここから読み込み時発火する
$(function () {
  // deviceにはdideosとaudiosが収納されている
  // 2-1:マイク、カメラ、解像度をselectの後ろに追加する
  getDevices(function (devices) {
    devices.audios.forEach(function (audio) {
      $("<option/>", {
        value: audio.value,
        text: audio.name,
      }).appendTo("#microphoneId");
    });
    devices.videos.forEach(function (video) {
      $("<option/>", {
        value: video.value,
        text: video.name,
      }).appendTo("#cameraId");
    });
    resolutions.forEach(function (resolution) {
      $("<option/>", {
        value: resolution.value,
        text: resolution.name,
      }).appendTo("#cameraResolution");
    });
    M.AutoInit();
  });

  var fields = ["appID", "channel"];

  // 入室ボタンをクリックした時
  $("#join").on("click", function (e) {
    e.preventDefault();
    // 3-1:各入力フォームは{key:name}で収納される
    var params = serializeformData();
    // 3-2:データとID&チャンネルの値が存在していればjoin実行
    if (validator(params, fields)) {
      join(rtc, params);
    }
  });
  // 公開ボタンをクリックした時
  $("#publish").on("click", function (e) {
    e.preventDefault();
    var params = serializeformData();
    if (validator(params, fields)) {
      publish(rtc);
    }
  });
  // 非公開ボタンを押した時
  $("#unpublish").on("click", function (e) {
    e.preventDefault();
    var params = serializeformData();
    if (validator(params, fields)) {
      unpublish(rtc);
    }
  });
  // 退室ボタンを押した時
  $("#leave").on("click", function (e) {
    e.preventDefault();
    var params = serializeformData();
    if (validator(params, fields)) {
      leave(rtc);
    }
  });
})
