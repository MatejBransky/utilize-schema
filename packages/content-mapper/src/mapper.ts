import { mapperHandlers } from './mapper-server';
import { serve } from './rpc';

serve(mapperHandlers());
