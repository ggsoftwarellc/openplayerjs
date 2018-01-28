import IEvent from '../components/interfaces/general/event';
import IFile from '../components/interfaces/media/file';
import { addEvent } from '../events';
import Media from '../media';
import { IS_ANDROID, IS_IOS, IS_SAFARI, IS_CHROME } from '../utils/constants';
import {loadScript} from '../utils/dom';
import { predictType } from '../utils/url';

declare const google: any;
/**
 * Ads
 *
 * @description This class implements Google IMA SDK v3.0 to display VAST and VPAID advertisement
 * @see https://developers.google.com/interactive-media-ads/
 * @class Ads
 */
class Ads {
    public element: HTMLMediaElement;
    public media: string;
    public promise: Promise<any>;
    private instance: Media;
    private events: IEvent;
    private adUrl: string;
    private adsManager: any;
    private adsLoader: any;
    private adsContainer: HTMLDivElement;
    private adDisplayContainer: any;
    private adsRequest: any;
    private adEnded: boolean;
    private adsDone: boolean;
    private adsActive: boolean;
    private adsStarted: boolean;
    private intervalTimer: number;

    /**
     * Creates an instance of Google IMA SDK.
     *
     * @param {Media} media
     * @param {object} file
     * @returns {Ads}
     * @memberof Ads
     */
    constructor(media: Media, file: string) {
        this.element = media.element;
        this.media = file;
        this.adUrl = media.ads;
        this.instance = media;
        this.adsManager = null;
        this.events = null;
        this.adEnded = false;
        this.adsDone = false;
        this.adsActive = false;
        this.adsStarted = false;
        this.intervalTimer = 0;

        this.promise = (typeof google === 'undefined' || typeof google.ima === 'undefined') ?
            loadScript('https://imasdk.googleapis.com/js/sdkloader/ima3.js') :
            new Promise(resolve => {
                resolve();
            });

        return this;
    }

    public canPlayType(mimeType: string) {
        return this.adsLoader !== null && /\.(mp[34]|m3u8|mpd)/.test(mimeType);
    }
    /**
     * Create the Ads container and loader to process the Ads URL provided.
     *
     * @memberof Ads
     */
    public load() {
        this.adsContainer = document.createElement('div');
        this.adsContainer.id = 'om-ads';
        this.element.parentNode.insertBefore(this.adsContainer, this.element.nextSibling);
        this.element.classList.add('om-ads--active');

        google.ima.settings.setVpaidMode(google.ima.ImaSdkSettings.VpaidMode.INSECURE);
        this.adDisplayContainer =
            new google.ima.AdDisplayContainer(
                this.adsContainer,
                this.element,
            );

        this.adsLoader = new google.ima.AdsLoader(this.adDisplayContainer);
        this.adsLoader.getSettings().setDisableCustomPlaybackForIOS10Plus(true);

        const loaded = google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED;
        const error = google.ima.AdErrorEvent.Type.AD_ERROR;

        this.adsLoader.addEventListener(error, this._error.bind(this));
        this.adsLoader.addEventListener(loaded, this._loaded.bind(this));

        // Create responsive ad
        window.addEventListener('resize', this._resizeAds.bind(this));

        this.element.onended = this._contentEndedListener.bind(this);
        this._requestAds();
    }

    public play() {
        if (!this.adsDone) {
            this.adDisplayContainer.initialize();
            this.adsDone = true;
        }
        if (this.adsManager) {
            this.adsManager.resume();
            const e = addEvent('play');
            this.element.dispatchEvent(e);
            this.adsActive = true;
        } else {
            this.instance.play();
        }
    }

    public pause() {
        if (this.adsManager) {
            this.adsManager.pause();
            const e = addEvent('pause');
            this.element.dispatchEvent(e);
            this.adsActive = false;
        } else {
            this.instance.pause();
        }
    }

    public destroy() {
    }

    set src(media: IFile) {
        console.log(media);
    }

    set volume(value) {
        this.element.volume = value;
    }

    get volume() {
        return this.element.volume;
    }

    set muted(value) {
        this.element.muted = value;
    }

    get muted() {
        return this.element.muted;
    }

    get paused() {
        return !this.adsActive;
    }

    get ended() {
        return this.adEnded;
    }

    private _assign(event: any) {
        const ad = event.getAd();
        switch (event.type) {
            case google.ima.AdEvent.Type.LOADED:
                if (!ad.isLinear()) {
                    this._onContentResumeRequested();
                }
                break;
            case google.ima.AdEvent.Type.STARTED:
                if (ad.isLinear()) {
                    this.intervalTimer = window.setInterval(() => {
                        const remainingTime = this.adsManager.getRemainingTime();
                        console.log(remainingTime);
                    }, 300);
                }
                break;
            case google.ima.AdEvent.Type.COMPLETE:
                if (ad.isLinear()) {
                    clearInterval(this.intervalTimer);
                }
                break;
        }
    }

    private _error(event: any) {
        console.error(`Ad error: ${event.getError().toString()}`);
        if (this.adsManager) {
            this.adsManager.destroy();
        }
        this._resumeMedia();
    }

    private _loaded(adsManagerLoadedEvent: any) {
        const adsRenderingSettings = new google.ima.AdsRenderingSettings();
        adsRenderingSettings.restoreCustomPlaybackStateOnAdBreakComplete = true;

        // Get the ads manager.
        this.adsManager = adsManagerLoadedEvent.getAdsManager(this.element, adsRenderingSettings);
        this._start(this.adsManager);
    }

    // _revoke() {
    //
    // }

    private _start(manager: any) {
        // Add listeners to the required events.
        manager.addEventListener(
            google.ima.AdErrorEvent.Type.AD_ERROR,
            this._error.bind(this));
        manager.addEventListener(
            google.ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED,
            this._onContentPauseRequested.bind(this));
        manager.addEventListener(
            google.ima.AdEvent.Type.CONTENT_RESUME_REQUESTED,
            this._onContentResumeRequested.bind(this));

        this.events = {
            a: google.ima.AdEvent.Type.ALL_ADS_COMPLETED,
            b: google.ima.AdEvent.Type.CLICK,
            c: google.ima.AdEvent.Type.COMPLETE,
            d: google.ima.AdEvent.Type.FIRST_QUARTILE,
            e: google.ima.AdEvent.Type.LOADED,
            f: google.ima.AdEvent.Type.MIDPOINT,
            g: google.ima.AdEvent.Type.PAUSED,
            h: google.ima.AdEvent.Type.STARTED,
            i: google.ima.AdEvent.Type.THIRD_QUARTILE,
        };

        Object.keys(this.events).forEach(event => {
            manager.addEventListener(this.events[event], this._assign.bind(this));
        });

        try {
            // Initialize the ads manager. Ad rules playlist will start at this time.
            manager.init(
                this.element.offsetWidth,
                this.element.offsetHeight,
                google.ima.ViewMode.NORMAL,
            );

            this.adsActive = true;
            manager.start();
            const e = addEvent('play');
            this.element.dispatchEvent(e);
        } catch (adError) {
            this._resumeMedia();
        }
    }

    private _contentEndedListener() {
        this.adEnded = true;
        this.adsActive = false;
        this.adsStarted = false;
        this.adsLoader.contentComplete();
    }

    private _onContentPauseRequested() {
        this.element.removeEventListener('ended', this._contentEndedListener.bind(this));
        if (this.adsStarted) {
            this.instance.pause();
        } else {
            this.adsStarted = true;
        }
    }

    private _onContentResumeRequested() {
        this.element.addEventListener('ended', this._contentEndedListener.bind(this));
        this._resumeMedia();
    }

    private _resumeMedia() {
        this.adEnded = true;
        this.adsActive = false;
        this.adsStarted = false;
        this.element.classList.remove('om-ads--active');
        this.instance.ads = null;
        this.instance.loadSources([
            {
                src: this.media,
                type: predictType(this.media),
            },
        ]);
        this.instance.play();
    }

    private _resizeAds() {
        if (this.adsManager) {
            this.adsManager.resize(
                (this.element.parentNode as HTMLElement).offsetWidth,
                (this.element.parentNode as HTMLElement).offsetHeight,
                google.ima.ViewMode.NORMAL);
        }
    }

    private _requestAds() {
        if (this.adsLoader) {
            this.adsLoader.contentComplete();
        }
        this.adsRequest = new google.ima.AdsRequest();
        this.adsRequest.adTagUrl = this.adUrl;

        const width = (this.element.parentNode as HTMLElement).offsetWidth;
        const height = (this.element.parentNode as HTMLElement).offsetWidth;
        this.adsRequest.linearAdSlotWidth = width;
        this.adsRequest.linearAdSlotHeight = height;
        this.adsRequest.nonLinearAdSlotWidth = width;
        this.adsRequest.nonLinearAdSlotHeight = 150;

        this.adsRequest.setAdWillAutoPlay(!(IS_ANDROID || IS_IOS));
        this.adsRequest.setAdWillPlayMuted(IS_IOS && (IS_SAFARI || IS_CHROME));

        this.adsLoader.requestAds(this.adsRequest);
    }
}

export default Ads;
