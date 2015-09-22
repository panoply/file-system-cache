"use strict"
import R from "ramda";
import Promise from "bluebird";
import fs from "fs-extra";
import * as f from "./funcs";

const formatPath = R.pipe(f.ensureString("./.build"), f.toAbsolutePath);



/**
 * A cache that read/writes to a specific part of the file-system.
 */
export default class FileSystemCache {
  /**
   * Constructor.
   * @param options
   *            - basePath:   The folder path to read/write to.
   *                          Default: "./build"
   *            - ns:         A single value, or array, that represents a
   *                          a unique namespace within which values for this
   *                          store are cached.
   *            - extension:  An optional file-extension for paths.
   */
  constructor({ basePath, ns, extension } = {}) {
    this.basePath = formatPath(basePath);
    this.ns = f.hash(ns);
    if (f.isString(extension)) { this.extension = extension; }
    if (f.isFileSync(this.basePath)) { throw new Error(`The basePath '${ this.basePath }' is a file. It should be a folder.`); }
  }

  /**
   * Generates the path to the cached files.
   * @param {string} key: The key of the cache item.
   * @return {string}.
   */
  path(key) {
    if (f.isNothing(key)) { throw new Error(`Path requires a cache key.`); }
    let name = f.hash(key);
    if (this.ns) { name = `${ this.ns }-${ name }`; }
    if (this.extension) {
      name = `${ name }.${ this.extension.replace(/^\./, "") }`;
    }
    return `${ this.basePath }/${ name }`;
  }


  /**
   * Determines whether the file exists.
   * @param {string} key: The key of the cache item.
   * @return {Promise}
   */
  fileExists(key) { return f.fileExistsP(this.path(key)); }


  /**
   * Ensure that the base path exists.
   * @return {Promise}
   */
  ensureBasePath() {
    return new Promise((resolve, reject) => {
      if (this.basePathExists) {
        resolve();
      } else {
        fs.ensureDir(this.basePath, (err) => {
          if (err) {
            reject(err);
          } else {
            this.basePathExists = true;
            resolve();
          }
        });
      }
    });
  }


  /**
   * Gets the contents of the file with the given key.
   * @param {string} key: The key of the cache item.
   * @return {Promise} - File contents, or
   *                     Undefined if the file does not exist.
   */
  get(key) {
    return new Promise((resolve, reject) => {
          const path = this.path(key);
          fs.readJson(path, (err, result) => {
            if (err) {
              if (err.code === "ENOENT") {
                resolve(undefined);
              } else {
                reject(err);
              }
            } else {
              let { value, type } = result;
              if (type === "Date") { value = new Date(value); }
              resolve(value);
            }
          });
    });
  }


  /**
   * Writes the given value to the file-system and memory cache.
   * @param {string} key: The key of the cache item.
   * @param value: The value to write (Primitive or Object).
   * @return {Promise}
   */
  set(key, value) {
    const path = this.path(key);
    return new Promise((resolve, reject) => {
      this.ensureBasePath()
      .then(() => {
          const json = {
            value,
            type: R.type(value)
          }
          fs.outputFile(path, JSON.stringify(json), (err) => {
            if (err) { reject(err); } else { resolve({ path }); }
          });
      })
      .catch(err => reject(err));
    });
  }


  /**
   * Removes the item from the file-system.
   * @param {string} key: The key of the cache item.
   * @return {Promise}
   */
  remove(key) { return f.removeFileP(this.path(key)); }


  /**
   * Removes all items from the cache.
   * @return {Promise}
   */
  clear() {
    return new Promise((resolve, reject) => {
      fs.readdir(this.basePath, (err, fileNames) => {
        if (err) {
          reject(err)
        } else {
          const paths = R.pipe(
              f.compact,
              R.filter((name) => this.ns ? name.startsWith(this.ns) : true),
              R.filter((name) => !this.ns ? !R.contains("-")(name) : true),
              R.map(name => `${ this.basePath }/${ name }`)
          )(fileNames);

          const remove = (index) => {
              const path = paths[index];
              if (path) {
                f.removeFileP(path)
                .then(() => remove(index + 1)) // <== RECURSION
                .catch(err => reject(err));
              } else {
                resolve() // All files have been removed.
              }
          };
          remove(0)
        }
      })
    });
  }


  /**
   * Saves several items to the cache in one operation.
   * @param {array} items: An array of objects of the form { key, value }.
   * @return {Promise}
   */
  save(items) {
    if (!R.is(Array, items)) { items = [items]; }
    const isValidItem = (item) => {
      if (!R.is(Object, item)) { return false; }
      return item.key && item.value;
    };
    items = R.pipe(
      R.reject(R.isNil),
      R.forEach((item) => { if (!isValidItem(item)) { throw new Error(`Save items not valid, must be an array of {key, value} objects.`); }})
      // R.forEach(item => { if (!isValidItem(item)) throw new Error(`Items to save must be of the shape {key, value}.` })
    )(items)
    console.log("-------------------------------------------");
    console.log("items", items);
    return new Promise((resolve, reject) => {

    });
  }
}