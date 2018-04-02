/*
 * Copyright 2017 Jiří Janoušek <janousek.jiri@gmail.com>
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

'use strict';

(function (Nuvola) {
  // Create media player component
  var player = Nuvola.$object(Nuvola.MediaPlayer)

  // Handy aliases
  var PlaybackState = Nuvola.PlaybackState
  var PlayerAction = Nuvola.PlayerAction

  // Create new WebApp prototype
  var WebApp = Nuvola.$WebApp()

  // Initialization routines
  WebApp._onInitWebWorker = function (emitter) {
    Nuvola.WebApp._onInitWebWorker.call(this, emitter)

    var state = document.readyState
    if (state === 'interactive' || state === 'complete') {
      this._onPageReady()
    } else {
      document.addEventListener('DOMContentLoaded', this._onPageReady.bind(this))
    }
  }

  // Page is ready for magic
  WebApp._onPageReady = function () {
    // Connect handler for signal ActionActivated
    Nuvola.actions.connect('ActionActivated', this)

    // Start update routine
    this.volume = null
    this.update()
  }

  // Extract data from the web page
  WebApp.update = function () {
    var state = PlaybackState.UNKNOWN
    var elms = this.getElements()
    var time = this.parseTime(elms.timer)
    var track = {
      title: null,
      artist: null,
      album: null,
      artLocation: null,
      rating: null
    }
    var elm = document.querySelector('story-card header h1')
    if (elm) {
      track.title = elm.innerText || null
    }
    elm = document.querySelector('story-card .card__meta')
    if (elm && elm.firstElementChild) {
      track.album = elm.firstElementChild.innerText.trim() || null
    }
    elm = document.querySelector('story-card aside figure img')
    if (elm) {
      track.artLocation = elm.src || null
    }
    track.length = time ? time[1] : null
    player.setTrack(track)

    if (elms.play) {
      state = PlaybackState.PAUSED
    } else if (elms.pause) {
      state = PlaybackState.PLAYING
    }
    player.setPlaybackState(state)
    player.setCanPlay(!!elms.play)
    player.setCanPause(!!elms.pause)
    player.setCanGoPrev(!!elms.prev)
    player.setCanGoNext(!!elms.next)
    player.setTrackPosition(time ? time[0] : null)
    player.setCanSeek(state !== PlaybackState.UNKNOWN)

    if (this.volume === null && elms.volumeButton) {
      Nuvola.clickOnElement(elms.volumeButton)
    }
    var height = elms.volumeValue ? elms.volumeValue.style.height : null
    if (height !== null && height.endsWith('%')) {
      this.volume = (height.substr(0, height.length - 1) * 1) / 100
    }
    player.updateVolume(this.volume)
    player.setCanChangeVolume(!!elms.volumeButton)

    // Schedule the next update
    setTimeout(this.update.bind(this), 500)
  }

  WebApp.getElements = function () {
    var elms = {
      player: document.querySelector('player')
    }
    if (elms.player) {
      var playPause = elms.player.querySelector('toggle-play button')
      elms.pause = playPause.querySelector('.player__play-control__icon--pause') ? playPause : null
      elms.play = playPause.querySelector('.player__play-control__icon--play') ? playPause : null
      if (elms.play || elms.pause) {
        elms.prev = elms.player.querySelector('rewind button')
        elms.next = elms.player.querySelector('skip button')
        elms.timer = elms.player.querySelector('progress-bar .player__progress-bar__time')
        elms.progressBar = elms.player.querySelector('progress-bar .player__progress-bar__seek-bar')
      }
      elms.volumeValue = elms.player.querySelector('volume-controls .player__volume-menu__volume-bar__value')
      elms.volumeButton = elms.player.querySelector('volume-controls button')
    }
    return elms
  }

  WebApp.parseTime = function (timer) {
    if (timer && timer.innerText) {
      var time = timer.innerText.split('/')
      time[0] = Nuvola.parseTimeUsec(time[0])
      time[1] = Nuvola.parseTimeUsec(time[1])
      return time
    } else {
      return null
    }
  }

  // Handler of playback actions
  WebApp._onActionActivated = function (emitter, name, param) {
    var elms = this.getElements()
    switch (name) {
      case PlayerAction.TOGGLE_PLAY:
        if (elms.play) {
          Nuvola.clickOnElement(elms.play)
        } else if (elms.pause) {
          Nuvola.clickOnElement(elms.pause)
        }
        break
      case PlayerAction.PLAY:
        if (elms.play) {
          Nuvola.clickOnElement(elms.play)
        }
        break
      case PlayerAction.PAUSE:
      case PlayerAction.STOP:
        if (elms.pause) {
          Nuvola.clickOnElement(elms.pause)
        }
        break
      case PlayerAction.PREV_SONG:
        if (elms.prev) {
          Nuvola.clickOnElement(elms.prev)
        }
        break
      case PlayerAction.NEXT_SONG:
        if (elms.next) {
          Nuvola.clickOnElement(elms.pause)
        }
        break
      case PlayerAction.SEEK:
        var time = this.parseTime(elms.timer)
        if (time && elms.progressBar) {
          var total = time[1]
          if (param >= 0 && param <= total) {
            Nuvola.clickOnElement(elms.progressBar, param / total, 0.5)
          }
        }
        break
      case PlayerAction.CHANGE_VOLUME:
        var getSlider = () => elms.player.querySelector('volume-controls .player__volume-menu__volume-bar')
        if (elms.volumeButton) {
          if (!getSlider()) {
            Nuvola.clickOnElement(elms.volumeButton)
          }
          window.setTimeout(() => {
            var slider = getSlider()
            if (slider) {
              Nuvola.clickOnElement(slider, 0.5, 1.0 - param)
              this.volume = param
              Nuvola.clickOnElement(elms.volumeButton)
            }
          }, 10)
        }
        break
    }
  }

  WebApp.start()
})(this)  // function(Nuvola)
