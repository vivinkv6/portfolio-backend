import type { Core } from '@strapi/strapi';
import sharp from 'sharp';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }: { strapi: Core.Strapi }) {
    strapi.customFields.register({
      name: 'tags',
      type: 'text',
      inputSize: {
        default: 4,
        isResizable: true,
      },
    });

    // Fix EBUSY error on Windows by disabling sharp cache
    sharp.cache(false);
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap(/* { strapi }: { strapi: Core.Strapi } */) {},
};
