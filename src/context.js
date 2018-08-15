// @flow
import React, { type Node } from 'react';
import Component from '@reactions/component';
import { type SetResponseParams, type CacheProvider } from './_types';
import { STATES } from './statechart';

// $FlowFixMe
const { Provider, Consumer } = React.createContext({
  data: {},
  setResponse: (params: SetResponseParams) => {}
});

type ProviderProps = {
  children: Node,
  cacheProvider?: CacheProvider
};
type ProviderState = {
  data: Object,
  globalCacheProvider?: CacheProvider,
  setResponse: Function
};

class LoadsProvider extends React.Component<ProviderProps, ProviderState> {
  setResponse = (params: SetResponseParams) => {
    const { cacheProvider: globalCacheProvider } = this.props;
    const {
      cacheKey,
      cacheProvider: localCacheProvider,
      data: { error, response, state }
    } = params;
    const cacheProvider = localCacheProvider || globalCacheProvider;
    const value = {
      ...(state === STATES.SUCCESS ? { response } : {}),
      ...(state === STATES.ERROR ? { error } : {}),
      state
    };
    if (cacheProvider && cacheProvider.set) {
      cacheProvider.set(cacheKey, value);
    }
    this.setState({
      data: { ...this.state.data, [cacheKey]: value }
    });
  };

  state = {
    data: {},
    globalCacheProvider: this.props.cacheProvider,
    setResponse: this.setResponse
  };

  render = () => {
    const { children } = this.props;
    return <Provider value={this.state}>{children}</Provider>;
  };
}

type ConsumerProps = {
  cacheKey: string,
  cacheProvider?: CacheProvider,
  children: Function,
  loadOnMount: boolean
};

class LoadsConsumer extends React.Component<ConsumerProps> {
  getCacheResponse = ({
    cacheKey,
    cacheProvider,
    setState
  }: {
    cacheKey: string,
    cacheProvider?: Function,
    setState: Function // eslint-disable-line
  }) => {
    if (cacheProvider && cacheProvider.get) {
      const cacheResponse = cacheProvider.get(cacheKey);
      if (cacheResponse && cacheResponse.then && typeof cacheResponse.then === 'function') {
        return cacheResponse.then(cacheProviderData => setState({ cacheProviderData, hasLoaded: true })).catch(err => {
          console.error(`Error loading data from cacheProvider (cacheKey: ${cacheKey}). Error: ${err}`);
          setState({ hasLoaded: true });
        });
      }
      setState({ cacheProviderData: cacheResponse });
    }
    setState({ hasLoaded: true });
  };

  render = () => {
    const { cacheKey, cacheProvider: localCacheProvider, children } = this.props;
    return (
      <Consumer>
        {context => (
          <Component
            cacheKey={cacheKey}
            initialState={{
              cacheProviderData: null,
              cacheProvider: localCacheProvider || context.globalCacheProvider,
              hasLoaded: false
            }}
            didMount={({ state: { cacheProvider }, setState }) => {
              this.getCacheResponse({ cacheKey, cacheProvider, setState });
            }}
            didUpdate={({
              prevProps: { cacheKey: prevCacheKey },
              props: { cacheKey, loadOnMount },
              state: { cacheProvider },
              setState
            }) => {
              if (cacheKey && cacheKey !== prevCacheKey) {
                this.getCacheResponse({ cacheKey, cacheProvider, setState });
              }
            }}
          >
            {({ state: { cacheProviderData, cacheProvider, hasLoaded } }) => {
              return hasLoaded
                ? children({
                    cache: cacheProviderData || context.data[cacheKey],
                    setResponse: data => context.setResponse({ cacheKey, cacheProvider, data })
                  })
                : null;
            }}
          </Component>
        )}
      </Consumer>
    );
  };
}

export default class extends React.PureComponent<{}> {
  static Provider = LoadsProvider;
  static Consumer = LoadsConsumer;
}
