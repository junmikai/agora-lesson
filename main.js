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

function Toastify(options) {
  M.toast({ html: options.text, classes: options.classes })
}

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
function validator(formData, fields) {
  var keys = Object.keys(formData)
  for (let key of keys) {
    if (fields.indexOf(key) != -1) {
      if (!formData[key]) {
        Toast.error("Please Enter " + key)
        return false
      }
    }
  }
  return true
}
// フォームデータ(設定も含む)を配列化にしてobjにまとめる
function serializeformData() {
  var formData = $("#form").serializeArray()
  var obj = {}
  for (var item of formData) {
    var key = item.name
    var val = item.value
    obj[key] = val
  }
  return obj
}

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

function getDevices(next) {
  AgoraRTC.getDevices(function (items) {
    items.filter(function (item) {
      return ["audioinput", "videoinput"].indexOf(item.kind) !== -1
    })
      .map(function (item) {
        return {
          name: item.label,
          value: item.deviceId,
          kind: item.kind,
        }
      })
    var videos = []
    var audios = []
    for (var i = 0; i < items.length; i++) {
      var item = items[i]
      if ("videoinput" == item.kind) {
        var name = item.label
        var value = item.deviceId
        if (!name) {
          name = "camera-" + videos.length
        }
        videos.push({
          name: name,
          value: value,
          kind: item.kind
        })
      }
      if ("audioinput" == item.kind) {
        var name = item.label
        var value = item.deviceId
        if (!name) {
          name = "microphone-" + audios.length
        }
        audios.push({
          name: name,
          value: value,
          kind: item.kind
        })
      }
    }
    next({ videos: videos, audios: audios })
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
  // Occurs when the local stream is published.
  rtc.client.on("stream-published", function (evt) {
    Toast.notice("stream published success");
  });
  // Occurs when the remote stream is added.
  rtc.client.on("stream-added", function (evt) {
    var remoteStream = evt.stream;
    var id = remoteStream.getId();
    Toast.info("stream-added uid: " + id);
    if (id !== rtc.params.uid) {
      rtc.client.subscribe(remoteStream, function (err) {});
    }
  });
  // Occurs when a user subscribes to a remote stream.
  rtc.client.on("stream-subscribed", function (evt) {
    var remoteStream = evt.stream;
    var id = remoteStream.getId();
    rtc.remoteStreams.push(remoteStream);
    addView(id);
    remoteStream.play("remote_video_" + id);
    Toast.info("stream-subscribed remote-uid: " + id);
  });
  // Occurs when the remote stream is removed; for example, a peer user calls Client.unpublish.
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
  // もし入室済みの場合はエラーを返す
  if (rtc.joined) {
    Toast.error("Your already joined");
    return;
  }
  rtc.client = AgoraRTC.createClient({
    mode: option.mode,
    codec: option.codec,
  });
  // rtc = ビデオの情報全て
  // rtc.client = 配信の情報
  rtc.params = option;

  // 各種ボタンを押した時の処理
  handleEvents(rtc);

  // clientの初期化
  rtc.client.init(
    option.appID,
    function () {
      // チャンネルの参加
      rtc.client.join(
        // トークン
        option.token ? option.token : null,
        // チャンネル
        option.channel,
        // uid
        option.uid ? +option.uid : null,
        // チャンネルの参加した時の処理
        function (uid) {
          Toast.notice(
            "join channel: " + option.channel + " success, uid: " + uid
          );
          rtc.joined = true;
          rtc.params.uid = uid;

          // ローカルストリームを作成する
          rtc.localStream = AgoraRTC.createStream({
            streamID: rtc.params.uid,
            audio: true,
            video: true,
            screen: false,
            microphoneId: option.microphoneId,
            cameraId: option.cameraId,
          });
          // ローカルストリームを初期化します。 初期化の完了後に実行されるコールバック関数
          rtc.localStream.init(
            // 初期化に成功した時
            function () {
              // HTML要素ID「local_stream」でストリームを再生します
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
        // チャンネルの参加に失敗した時
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

function unpublish(rtc) {
  if (!rtc.client) {
    Toast.error("Please Join Room First")
    return
  }
  if (!rtc.published) {
    Toast.error("Your didn't publish")
    return
  }
  var oldState = rtc.published
  rtc.client.unpublish(rtc.localStream, function (err) {
    rtc.published = oldState
    Toast.error("unpublish failed")
    console.error(err)
  })
  Toast.info("unpublish")
  rtc.published = false
}

function leave(rtc) {
  if (!rtc.client) {
    Toast.error("Please Join First!")
    return
  }
  if (!rtc.joined) {
    Toast.error("You are not in channel")
    return
  }
  /**
   * Leaves an AgoraRTC Channel
   * This method enables a user to leave a channel.
   **/
  rtc.client.leave(function () {
    // stop stream
    if (rtc.localStream.isPlaying()) {
      rtc.localStream.stop()
    }
    // close stream
    rtc.localStream.close()
    for (let i = 0; i < rtc.remoteStreams.length; i++) {
      var stream = rtc.remoteStreams.shift()
      var id = stream.getId()
      if (stream.isPlaying()) {
        stream.stop()
      }
      removeView(id)
    }
    rtc.localStream = null
    rtc.remoteStreams = []
    rtc.client = null
    rtc.published = false
    rtc.joined = false
    Toast.notice("leave success")
  }, function (err) {
    Toast.error("leave success")
    console.error(err)
  })
}

// ここから読み込み時発火する
$(function () {
  // これにより、すべてのデバイスがフェッチされ、すべてのデバイスのUIが読み込まれます.（オーディオとビデオ)
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
    // カメラ解像度を設定のoptionを追加
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
    // データはフォーム要素から抜き出され、シリアル化(直列化)されます。
    var params = serializeformData();
    // データとID&チャンネルの値に問題がなければjoinを実行
    if (validator(params, fields)) {
      join(rtc, params);
    }
  });
  // This publishes the video feed to Agora
  $("#publish").on("click", function (e) {
    e.preventDefault();
    var params = serializeformData();
    if (validator(params, fields)) {
      publish(rtc);
    }
  });
  // Unpublishes the video feed from Agora
  $("#unpublish").on("click", function (e) {
    e.preventDefault();
    var params = serializeformData();
    if (validator(params, fields)) {
      unpublish(rtc);
    }
  });
  // Leeaves the chanenl if someone clicks the leave button
  $("#leave").on("click", function (e) {
    e.preventDefault();
    var params = serializeformData();
    if (validator(params, fields)) {
      leave(rtc);
    }
  });
})
