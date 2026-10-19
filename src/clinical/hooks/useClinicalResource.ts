import { useEffect, useState } from 'react';

export function useClinicalResource<T>(
  enabled: boolean,
  loader: () => Promise<T>,
  deps: readonly unknown[],
) {
  const [state, setState] = useState<{loading:boolean;data?:T;error?:string}>({loading:enabled});

  useEffect(() => {
    let cancelled=false;
    if (!enabled) {
      setState({loading:false});
      return;
    }
    setState((prev)=>({...prev,loading:true,error:undefined}));
    loader()
      .then((data)=>!cancelled && setState({loading:false,data}))
      .catch((error)=>!cancelled && setState({
        loading:false,
        error:error instanceof Error ? error.message : '요청에 실패했습니다.',
      }));
    return ()=>{cancelled=true};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
