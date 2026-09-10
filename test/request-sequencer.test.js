const test = require('node:test');
const assert = require('node:assert/strict');
const { RequestSequencer } = require('../.test-dist/request-sequencer');

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

test('a slow initial GET cannot overwrite a category confirmed by POST and refetch', async () => {
  const sequencer = new RequestSequencer();
  let categories = [];
  const initial = deferred();
  const initialSequence = sequencer.begin();
  const initialLoad = initial.promise.then((items) => {
    if (sequencer.isCurrent(initialSequence)) categories = items;
  });

  sequencer.invalidate(); // POST starts and invalidates the GET already in flight.
  categories = [{ _id: 'created', name: 'Hambúrgueres' }];
  const refetchSequence = sequencer.begin();
  if (sequencer.isCurrent(refetchSequence)) categories = [{ _id: 'created', name: 'Hambúrgueres' }];

  initial.resolve([]);
  await initialLoad;
  assert.deepEqual(categories.map((category) => category.name), ['Hambúrgueres']);
});
