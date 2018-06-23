import {
  GrafooBindings,
  ClientInstance,
  GrafooConsumerProps,
  GrafooRenderProps,
  ObjectsMap,
  GrafooRenderMutations
} from "@grafoo/types";

function shouldUpdate(nextObjects: ObjectsMap, objects?: ObjectsMap) {
  objects = objects || {};

  for (var i in nextObjects) {
    if (!(i in objects)) return 1;

    for (var j in nextObjects[i]) if (nextObjects[i][j] !== objects[i][j]) return 1;
  }

  for (var i in objects) if (!(i in nextObjects)) return 1;
}

export default function createBindings<T = {}, U = {}>(
  client: ClientInstance,
  props: GrafooConsumerProps<T, U>,
  updater: () => void
): GrafooBindings<T, U> {
  var { query, variables, mutations, skip } = props;
  var data: {};
  var objects: ObjectsMap;
  var unbind = () => {};
  var lockUpdate = 0;

  if (query) {
    ({ data, objects } = readFromCache());

    unbind = client.listen(nextObjects => {
      if (lockUpdate) return (lockUpdate = 0);

      if (shouldUpdate(nextObjects, objects)) performUpdate();
    });
  }

  var cacheLoaded = !skip && data;
  var state = (query
    ? { load, loaded: !!cacheLoaded, loading: !cacheLoaded }
    : {}) as GrafooRenderProps;
  var queryResult = {} as T;
  var mutationFns = {} as GrafooRenderMutations<U>;

  if (cacheLoaded) Object.assign(queryResult, data);

  if (mutations) {
    for (var key in mutations) {
      var mutation = mutations[key];

      mutationFns[key] = mutationVariables => {
        if (query && mutation.optimisticUpdate) {
          writeToCache(mutation.optimisticUpdate(queryResult, mutationVariables));
        }

        return client.request<U[typeof key]>(mutation.query, mutationVariables).then(data => {
          if (query && mutation.update) {
            writeToCache(mutation.update(queryResult, data));
          }

          return data;
        });
      };
    }
  }

  function writeToCache(data) {
    client.write(query, variables, data);
  }

  function readFromCache() {
    return client.read<T>(query, variables);
  }

  function performUpdate(stateUpdate?) {
    ({ data, objects } = readFromCache());

    Object.assign(queryResult, data);
    Object.assign(state, stateUpdate);

    updater();
  }

  function getState() {
    return Object.assign({ client }, state, queryResult, mutationFns);
  }

  function load() {
    if (!state.loading) {
      Object.assign(state, { loading: true });

      updater();
    }

    return client
      .request(query, variables)
      .then(response => {
        lockUpdate = 1;

        writeToCache(response);

        performUpdate({ loading: false, loaded: true });
      })
      .catch(({ errors }) => {
        Object.assign(state, { errors, loading: false, loaded: true });

        updater();
      });
  }

  return { getState, unbind, load };
}
