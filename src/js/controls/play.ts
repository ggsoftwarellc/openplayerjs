import PlayerComponent from '../interfaces/component';
import EventsList from '../interfaces/events-list';
import Player from '../player';
import { addEvent } from '../utils/events';
import { hasClass } from '../utils/general';

/**
 * Play/pause element.
 *
 * @description This class controls the state of the media, by playing or pausing it, and
 * when it ends, updates the state to replay the current media.
 * @see https://developer.mozilla.org/en-US/Apps/Fundamentals/Audio_and_video_delivery/cross_browser_video_player#PlayPause
 * @class Play
 * @implements PlayerComponent
 */
class Play implements PlayerComponent {
    /**
     * Instance of OpenPlayer.
     *
     * @private
     * @type Player
     * @memberof Play
     */
    private player: Player;

    /**
     * Button to play/pause media.
     *
     * @private
     * @type HTMLButtonElement
     * @memberof Play
     */
    private button: HTMLButtonElement;

    /**
     * Events that will be triggered in Play element:
     *  - controls (when `controlschanged` event is being triggered)
     *  - media (to toggle button's class and play/pause media)
     *
     * @private
     * @see [[Controls._buildElements]]
     * @type EventsList
     * @memberof Play
     */
    private events: EventsList = {
        controls: {},
        media: {},
    };

    /**
     * Create an instance of Play.
     *
     * @param {Player} player
     * @returns {Play}
     * @memberof Play
     */
    constructor(player: Player) {
        this.player = player;
        return this;
    }

    /**
     *
     * @inheritDoc
     * @memberof Play
     */
    public create(): void {
        this.button = document.createElement('button');
        this.button.type = 'button';
        this.button.className = 'om-controls__playpause';
        this.button.tabIndex = 0;
        this.button.title = 'Play';
        this.button.setAttribute('aria-controls', this.player.id);
        this.button.setAttribute('aria-pressed', 'false');
        this.button.setAttribute('aria-label', 'Play');
        this.button.innerHTML = '<span class="om-sr">Play/Pause</span>';
        this.player.getControls().getContainer().appendChild(this.button);

        this.events.media.click = (e: any) => {
            this.button.setAttribute('aria-pressed', 'true');
            const el = this.player.activeElement();
            if (el.paused || el.ended) {
                el.play();
            } else {
                el.pause();
            }

            e.preventDefault();
        };
        this.events.media.play = () => {
            if (this.player.activeElement().ended) {
                if (this.player.isMedia()) {
                    this.button.classList.add('om-controls__playpause--replay');
                } else {
                    this.button.classList.add('om-controls__playpause--pause');
                }
                this.button.title = 'Play';
                this.button.setAttribute('aria-label', 'Play');
            } else {
                this.button.classList.remove('om-controls__playpause--replay');
                this.button.classList.add('om-controls__playpause--pause');

                this.button.title = 'Pause';
                this.button.setAttribute('aria-label', 'Pause');

                Object.keys(Player.instances).forEach(key => {
                    if (key !== this.player.id) {
                        const target = Player.instances[key].activeElement();
                        target.pause();
                    }
                });
            }
        };
        this.events.media.loadedmetadata = () => {
            if (hasClass(this.button, 'om-controls__playpause--pause')) {
                this.button.classList.remove('om-controls__playpause--replay');
                this.button.classList.remove('om-controls__playpause--pause');
                this.button.title = 'Play';
                this.button.setAttribute('aria-label', 'Play');
            }
        };
        this.events.media.playing = () => {
            if (!hasClass(this.button, 'om-controls__playpause--pause')) {
                this.button.classList.remove('om-controls__playpause--replay');
                this.button.classList.add('om-controls__playpause--pause');
                this.button.title = 'Pause';
                this.button.setAttribute('aria-label', 'Pause');
            }
        };
        this.events.media.pause = () => {
            this.button.classList.remove('om-controls__playpause--pause');
            this.button.title = 'Play';
            this.button.setAttribute('aria-label', 'Play');
        };
        this.events.media.ended = () => {
            if (this.player.activeElement().ended && this.player.isMedia()) {
                this.button.classList.add('om-controls__playpause--replay');
                this.button.classList.remove('om-controls__playpause--pause');
            } else {
                this.button.classList.remove('om-controls__playpause--replay');
                this.button.classList.add('om-controls__playpause--pause');
            }
            this.button.title = 'Play';
            this.button.setAttribute('aria-label', 'Play');
        };
        this.events.media['adsmediaended'] = () => {
            this.button.classList.remove('om-controls__playpause--replay');
            this.button.classList.add('om-controls__playpause--pause');
            this.button.title = 'Pause Ads';
            this.button.setAttribute('aria-label', 'Pause Ads');
        };

        const element = this.player.getElement();
        this.events.controls.controlschanged = () => {
            if (!this.player.activeElement().paused) {
                const event = addEvent('playing');
                element.dispatchEvent(event);
            }
        };

        Object.keys(this.events.media).forEach(event => {
            element.addEventListener(event, this.events.media[event]);
        });

        this.player.getControls().getContainer().addEventListener('controlschanged', this.events.controls.controlschanged);

        this.button.addEventListener('click', this.events.media.click);
    }

    /**
     *
     * @inheritDoc
     * @memberof Play
     */
    public destroy(): void {
        Object.keys(this.events.media).forEach(event => {
            this.player.getElement().removeEventListener(event, this.events.media[event]);
        });

        this.player.getControls().getContainer().removeEventListener('controlschanged', this.events.controls.controlschanged);

        this.button.removeEventListener('click', this.events.media.click);
        this.button.remove();
    }
}

export default Play;
