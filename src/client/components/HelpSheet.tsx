import { RULES } from '../rules';
import { Icon, TagIcon } from './Art';

/** Compact "how to play": one line per idea, no wall of text. */
export const HelpSheet = ({ onClose }: { onClose: () => void }) => (
  <div
    className="backdrop"
    role="dialog"
    aria-modal="true"
    aria-label="How to play"
    onClick={onClose}
  >
    <div className="sheet" onClick={(e) => e.stopPropagation()}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2>Pack the whole receipt</h2>
        <button
          type="button"
          className="icon-btn shrink-0"
          onClick={onClose}
          aria-label="Close"
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="help-row">
        <span className="ico">
          <Icon name="tap" size={20} />
        </span>
        <span>Tap an item, then tap the bag. Or just drag it in.</span>
      </div>
      <div className="help-row">
        <span className="ico">
          <Icon name="rotate" size={20} />
        </span>
        <span>Turn the item in your hand with Rotate, or tap it again.</span>
      </div>
      {RULES.map((rule) => (
        <div key={rule.id} className="help-row">
          <span className="ico rule-chip !h-[34px] !shadow-none">
            {rule.icons.map((tag) => (
              <TagIcon
                key={tag}
                tag={tag}
                size={rule.icons.length > 1 ? 12 : 18}
              />
            ))}
          </span>
          <span>{rule.help}</span>
        </div>
      ))}
      <div className="help-row">
        <span className="ico">
          <Icon name="receipt" size={20} />
        </span>
        <span>Done? Vote for tomorrow’s receipt, or write your own.</span>
      </div>
      <button type="button" className="big-btn mt-3" onClick={onClose}>
        Let’s bag
      </button>
    </div>
  </div>
);
