// fallow-ignore-file coverage-gaps -- the mapper runs in the child process TypeScript spawns; the integration tests exercise it end to end

import { mapperHandlers } from './mapper-server';
import { serve } from './rpc';

serve(mapperHandlers());
