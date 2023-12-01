import { MediaPlayer, LogLevel } from 'dashjs';
import { EventsList, Level, Source } from '../interfaces';
import { HAS_MSE } from '../utils/constants';
import { addEvent } from '../utils/general';
import { isDashSource } from '../utils/media';
import Native from './native';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const dashjs: any;

class DashMedia extends Native {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    #player: any;

    // @see http://cdn.dashjs.org/latest/jsdoc/MediaPlayerEvents.html
    #events: EventsList = {};

    #options?: unknown = {};

    constructor(element: HTMLMediaElement, mediaSource: Source, options?: unknown) {
        super(element, mediaSource);
        this.#options = options;
        this.#player = MediaPlayer().create();
        this.instance = this.#player;
    }

    canPlayType(mimeType: string): boolean {
        return HAS_MSE && mimeType === 'application/dash+xml';
    }

    load(): void {
        this._preparePlayer();
        this.#player.attachSource(this.media.src);

        const e = addEvent('loadedmetadata');
        this.element.dispatchEvent(e);

        if (!Object.keys(this.#events).length) {
            this.#events = MediaPlayer.events;
            Object.keys(this.#events).forEach(event => {
                this.#player.on(this.#events[event], this._assign.bind(this));
            });
        }

        
        this.promise = new Promise<void>(resolve => {
            this.#player.on('streamActivated', () => {
                resolve();
            });
        });
    }

    destroy(): void {
        if (this.#events) {
            Object.keys(this.#events).forEach((event) => {
                this.#player.off(this.#events[event], this._assign);
            });
            this.#events = [];
        }
        this.#player.reset();
    }

    set src(media: Source) {
        if (isDashSource(media)) {
            this.destroy();
            this.#player = MediaPlayer().create();
            this._preparePlayer();
            this.#player.attachSource(media.src);

            this.#events = MediaPlayer.events;
            Object.keys(this.#events).forEach(event => {
                this.#player.on(this.#events[event], this._assign.bind(this));
            });
        }
    }

    get levels(): Level[] {
        const levels: Level[] = [];
        if (this.#player) {
            const bitrates = this.#player.getBitrateInfoListFor('video');
            for (let i = 0; i < bitrates.length; i++) {
                const level = {
                    height: bitrates[i].height,
                    id: `${i}`,
                    label: bitrates[i].scanType,
                };
                levels.push(level);
            }
        }
        return levels;
    }

    set level(level: string) {
        if (level === '-1') {
            this.#player.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: true } } } });
        } else {
            this.#player.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: false } } } });
            this.#player.setQualityFor('video', level);
        }
    }

    get level(): string {
        return this.#player ? this.#player.getQualityFor('video') : '-1';
    }

    // @see http://cdn.dashjs.org/latest/jsdoc/MediaPlayerEvents.html
    private _assign(event: Event): void {
        if (event.type === 'error') {
            const details = {
                detail: {
                    message: event,
                    type: 'M(PEG)-DASH',
                },
            };
            const errorEvent = addEvent('playererror', details);
            this.element.dispatchEvent(errorEvent);
        } else {
            const e = addEvent(event.type, { detail: event });
            this.element.dispatchEvent(e);
        }
    }

    private _preparePlayer(): void {
        this.#player.updateSettings({
            debug: {
                // logLevel: LogLevel.LOG_LEVEL_DEBUG,
                logLevel: LogLevel.LOG_LEVEL_ERROR,
            },
            streaming: {
                abr: {
                    limitBitrateByPortal: true,
                },
                buffer: {
                    fastSwitchEnabled: true,
                },
                scheduling: {
                    scheduleWhilePaused: false,
                },
            },
            ...((this.#options as Record<string, unknown>) || {}),
        });
        this.#player.initialize();
        this.#player.attachView(this.element);
        this.#player.setAutoPlay(false);
    }
}

export default DashMedia;
