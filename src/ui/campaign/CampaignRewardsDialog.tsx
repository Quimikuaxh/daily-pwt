import { Modal } from '../common/Modal'
import { itemIconUrl } from '../common/spriteUrls'
import { esCampaign } from '../../i18n/esCampaign'
import type { campaignRewards } from './campaignRewards'

const text = esCampaign.rewards

export function CampaignRewardsDialog({ rewards, itemName, onContinue }: {
  rewards: ReturnType<typeof campaignRewards>
  itemName: (id: string) => string
  onContinue: () => void
}) {
  return (
    <Modal title={text.title} onClose={onContinue} className="campaign-rewards"
      footer={<button type="button" className="campaign-action" onClick={onContinue}>{text.continue}</button>}>
      <div className="campaign-reward-groups">
        {rewards.items.length > 0 && (
          <section>
            <h3>{text.items}</h3>
            <ul>{rewards.items.map(({ id, count }) => (
              <li key={id}>
                <img src={itemIconUrl(id)} alt="" width={26} height={26} />
                <span>{Number.isFinite(count) ? text.amount(itemName(id), count) : itemName(id)}</span>
                {!Number.isFinite(count) && <small>{text.unlimited}</small>}
              </li>
            ))}</ul>
          </section>
        )}
        {rewards.machines.length > 0 && (
          <section>
            <h3>{text.machines}</h3>
            <ul>{rewards.machines.map(({ id, name }) => <li key={id}>{name}</li>)}</ul>
          </section>
        )}
      </div>
    </Modal>
  )
}
