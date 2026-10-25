import { forwardApi } from '../../../../src/server/apiProxy';

export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';

export {
  forwardApi as DELETE,
  forwardApi as GET,
  forwardApi as HEAD,
  forwardApi as OPTIONS,
  forwardApi as PATCH,
  forwardApi as POST,
  forwardApi as PUT,
};
