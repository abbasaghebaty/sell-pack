import { ensureUser } from '../database/users.js';

import {
  createPurchase,
  getActivePurchase,
  getPendingBlupalPurchase,
  attachBlupalInvoice,
  cancelWaitingPurchase,
} from '../database/coursePurchasesQueries.js';

import {
  createBlupalInvoice,
} from '../api/blupal.js';

export async function resolveSubscriptionContext(
  db,
  telegramUser,
  plan,
) {
  const user =
    await ensureUser(
      db,
      telegramUser,
    );

  if (!user?.id) {
    throw new Error(
      'Could not resolve internal user id.',
    );
  }

  const activePurchase =
    await getActivePurchase(
      db,
      user.id,
    );

  if (activePurchase) {
    return {
      user,
      activePurchase,
      pendingPurchase: null,
      purchase: null,
    };
  }

  const pendingPurchase =
    await getPendingBlupalPurchase(
      db,
      user.id,
      plan.code,
    );

  if (pendingPurchase) {
    return {
      user,
      activePurchase: null,
      pendingPurchase,
      purchase: null,
    };
  }

  const purchase =
    await createPurchase(
      db,
      user.id,
      plan,
    );

  return {
    user,
    activePurchase: null,
    pendingPurchase: null,
    purchase,
  };
}

export async function createSubscriptionInvoice(
  db,
  env,
  purchase,
) {
  try {
    const invoice =
      await createBlupalInvoice(
        env,
        purchase.rialAmount,
      );

    await attachBlupalInvoice(
      db,
      purchase.id,
      invoice,
    );

    return invoice;
  } catch (error) {
    await cancelWaitingPurchase(
      db,
      purchase.id,
    );

    throw error;
  }
}

export async function recoverPendingSubscription(
  db,
  telegramUser,
  plan,
) {
  try {
    const user =
      await ensureUser(
        db,
        telegramUser,
      );

    if (!user?.id) {
      return null;
    }

    return getPendingBlupalPurchase(
      db,
      user.id,
      plan.code,
    );
  } catch (error) {
    console.error(
      'Pending purchase recovery failed:',
      error.message,
    );

    return null;
  }
}
