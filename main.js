/*jshint esversion:6*/

$(function () {
  //read cam from query

  const queryString = window.location.search;
  console.log("alex query=", queryString);
  const urlParams = new URLSearchParams(queryString);

  var model;
  var publishable_key = "rf_MW0Oe1W9FiVJMKfgbAkrdjnYQqu1";
  var toLoad = {
    model: "butterfly-fhrir",
    version: 2,
  };
  var deviceID = "161117297";
  var oneNetApiKey = "KNUTSbBe6O5zyHYQWv=VkKiarJo=";

  key = urlParams.get("key");
  model = urlParams.get("model");
  version = urlParams.get("version");
  deviceID = urlParams.get("deviceID");
  oneNetApiKey = urlParams.get("oneNetApiKey");

  if (
    key &&
    model &&
    version &&
    deviceID &&
    oneNetApiKey &&
    key !== "" &&
    model !== "" &&
    version !== "" &&
    deviceID !== "" &&
    oneNetApiKey !== "" &&
    queryString !== ""
  ) {
    publishable_key = key;
    toLoad = {
      model: model,
      version: version,
    };
    console.log("Publishable key=", publishable_key);
    console.log("model=", model, " ,version=", version);
    console.log("deviceID=", deviceID, " ,oneNetApiKey=", oneNetApiKey);
  } else {
    console.log("use default model");
  }
  console.log("End config");

  const video = $("video")[0];

  var model;
  var cameraMode = "environment"; // or "user"

  const startVideoStreamPromise = navigator.mediaDevices
    .getUserMedia({
      audio: false,
      video: {
        facingMode: cameraMode,
      },
    })
    .then(function (stream) {
      console.log("camera set");
      return new Promise(function (resolve) {
        video.srcObject = stream;
        console.log("camera=", stream);
        video.onloadeddata = function () {
          video.play();
          console.log("camera ready");
          resolve();
        };
      });
    });

  const loadModelPromise = new Promise(function (resolve, reject) {
    roboflow
      .auth({
        publishable_key: publishable_key,
      })
      .load(toLoad)
      .then(function (m) {
        model = m;
        resolve();
      });
  });

  Promise.all([startVideoStreamPromise, loadModelPromise]).then(function () {
    $("#cameraVideo").removeClass("loading");
    resizeCanvas();
    detectFrame();
  });

  var canvas, ctx;
  const font = "16px sans-serif";

  function videoDimensions(video) {
    // Ratio of the video's intrisic dimensions
    var videoRatio = video.videoWidth / video.videoHeight;

    // The width and height of the video element
    var width = video.offsetWidth,
      height = video.offsetHeight;

    // The ratio of the element's width to its height
    var elementRatio = width / height;

    // If the video element is short and wide
    if (elementRatio > videoRatio) {
      width = height * videoRatio;
    } else {
      // It must be tall and thin, or exactly equal to the original ratio
      height = width / videoRatio;
    }

    return {
      width: width,
      height: height,
    };
  }

  $(window).resize(function () {
    resizeCanvas();
  });

  const resizeCanvas = function () {
    $("canvas").remove();

    canvas = $("<canvas/>");

    ctx = canvas[0].getContext("2d");

    var dimensions = videoDimensions(video);

    console.log(
      video.videoWidth,
      video.videoHeight,
      video.offsetWidth,
      video.offsetHeight,
      dimensions
    );

    canvas[0].width = video.videoWidth;
    canvas[0].height = video.videoHeight;

    canvas.css({
      width: dimensions.width,
      height: dimensions.height,
      left: ($(window).width() - dimensions.width) / 2,
      top: ($(window).height() - dimensions.height) / 2,
    });

    $("body").append(canvas);
  };

  const renderPredictions = function (predictions) {
    var dimensions = videoDimensions(video);

    var scale = 1;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    predictions.forEach(function (prediction) {
      const x = prediction.bbox.x;
      const y = prediction.bbox.y;

      const width = prediction.bbox.width;
      const height = prediction.bbox.height;

      // Draw the bounding box.
      ctx.strokeStyle = prediction.color;
      ctx.lineWidth = 4;
      ctx.strokeRect(
        (x - width / 2) / scale,
        (y - height / 2) / scale,
        width / scale,
        height / scale
      );

      // Draw the label background.
      ctx.fillStyle = prediction.color;
      const textWidth = ctx.measureText(prediction.class).width;
      const textHeight = parseInt(font, 10); // base 10
      ctx.fillRect(
        (x - width / 2) / scale,
        (y - height / 2) / scale,
        textWidth + 8,
        textHeight + 4
      );
    });

    predictions.forEach(function (prediction) {
      const x = prediction.bbox.x;
      const y = prediction.bbox.y;

      const width = prediction.bbox.width;
      const height = prediction.bbox.height;

      // Draw the text last to ensure it's on top.
      ctx.font = font;
      ctx.textBaseline = "top";
      ctx.fillStyle = "#000000";
      console.log("Object detected:", prediction.class);
      postToOnenet(prediction.class, deviceID, oneNetApiKey);
      ctx.fillText(
        prediction.class,
        (x - width / 2) / scale + 4,
        (y - height / 2) / scale + 1
      );
    });
  };

  var prevTime;
  var pastFrameTimes = [];
  const detectFrame = function () {
    if (!model) return requestAnimationFrame(detectFrame);

    model
      .detect(video)
      .then(function (predictions) {
        requestAnimationFrame(detectFrame);
        renderPredictions(predictions);

        if (prevTime) {
          pastFrameTimes.push(Date.now() - prevTime);
          if (pastFrameTimes.length > 30) pastFrameTimes.shift();

          var total = 0;
          _.each(pastFrameTimes, function (t) {
            total += t / 1000;
          });

          var fps = pastFrameTimes.length / total;
          $("#fps").text(Math.round(fps));
        }
        prevTime = Date.now();
      })
      .catch(function (e) {
        console.log("CAUGHT", e);
        requestAnimationFrame(detectFrame);
      });
  };
});

function postToOnenet(butterfly_name, deviceID, apiKey) {
  clear();
  // Do a POST request to the test API
  let api_url = "https://butterfly-api.vercel.app/api/butterfly";

  let postData = {
    butterfly: butterfly_name,
    deviceID: deviceID,
    apiKey: apiKey,
  };

  httpDo(
    api_url,
    "POST",
    {
      "Content-Type": "text/plain",
    },
    postData,
    function (response) {
      text("res=" + response, 20, 140);
    }
  );
}
