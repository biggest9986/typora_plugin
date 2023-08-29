package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type Inserter struct {
	root          string
	match         string
	insertFile    string
	insertContent string
}

func NewInserter() (*Inserter, error) {
	curDir, err := os.Getwd()
	if err != nil {
		return nil, err
	}
	return &Inserter{
		root:          filepath.Dir(filepath.Dir(curDir)),
		insertFile:    "window.html",
		insertContent: `<script src="./plugin/index.js" defer="defer"></script>`,
	}, nil
}

func (i *Inserter) prepare() (err error) {
	betaDir := "app"
	normalDir := "appsrc"
	betaMatch := `<script src="./app/window/frame.js" defer="defer"></script>`
	normalMatch := `<script src="./appsrc/window/frame.js" defer="defer"></script>`

	if err = checkExist(i.root, i.insertFile); err != nil {
		return err
	}

	err = checkExist(i.root, betaDir)
	if err == nil {
		i.match = betaMatch
		return nil
	}
	err = checkExist(i.root, normalDir)
	if err == nil {
		i.match = normalMatch
		return nil
	}
	return err
}

func (i *Inserter) run() (err error) {
	filePath := filepath.Join(i.root, i.insertFile)
	file, err := ioutil.ReadFile(filePath)
	if err != nil {
		return err
	}
	if bytes.Contains(file, []byte(i.insertContent)) {
		fmt.Println("had in inserted")
		return
	}

	result := bytes.Replace(file, []byte(i.match), []byte(i.match+i.insertContent), 1)
	err = ioutil.WriteFile(filePath, result, 0644)
	if err != nil {
		return err
	}
	fmt.Println("Done")
	return nil
}

type Updater struct {
	url          string
	timeout      int
	root         string
	versionFile  string
	downloadFile string
	unzipDir     string

	userSettingFiles []string

	oldVersionInfo *VersionInfo
	newVersionInfo *VersionInfo
}

func NewUpdater() (*Updater, error) {
	curDir, err := os.Getwd()
	if err != nil {
		return nil, err
	}
	updater := &Updater{
		url:          "https://api.github.com/repos/obgnail/typora_plugin/releases/latest",
		timeout:      30,
		root:         filepath.Dir(filepath.Dir(curDir)),
		versionFile:  filepath.Join(curDir, "version.json"),
		downloadFile: filepath.Join(curDir, "download.zip"),
		unzipDir:     curDir,
		userSettingFiles: []string{
			"./plugin/global/settings/custom_plugin.user.toml",
			"./plugin/global/settings/settings.user.toml",
		},
		oldVersionInfo: nil,
		newVersionInfo: nil,
	}
	return updater, nil
}

func (u *Updater) newHTTPClient() *http.Client {
	uri, err := url.Parse("http://127.0.0.1:7890")
	if err != nil {
		panic(err)
	}
	return &http.Client{
		Timeout: time.Duration(u.timeout) * time.Second,
		Transport: &http.Transport{
			Proxy: http.ProxyURL(uri),
		},
	}
}

func (u *Updater) deleteResidualFile() (err error) {
	obj := regexp.MustCompile(`updater(\d+\.\d+\.\d+)?\.exe`)

	pluginDir := filepath.Join(u.root, "./plugin")
	var result [][]string
	err = filepath.Walk(pluginDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			version := obj.FindString(info.Name())
			result = append(result, []string{version, path})
		}
		return nil
	})
	if err != nil || len(result) != 2 {
		return
	}

	var deleteFile string
	compare := u.compareVersion(result[0][0], result[1][0])
	if compare == 1 {
		deleteFile = result[1][1]
	} else {
		deleteFile = result[0][1]
	}
	return os.Remove(deleteFile)
}

type VersionInfo struct {
	TagName    string `json:"tag_name"`
	Name       string `json:"name"`
	Body       string `json:"body"`
	ZipBallUrl string `json:"zipball_url"`
}

func (u *Updater) needUpdate() bool {
	var err error
	if u.newVersionInfo, err = u.getLatestVersion(); err != nil {
		fmt.Println("get latest version error:", err)
		return false
	}
	if u.oldVersionInfo, err = u.getCurrentVersion(); err != nil {
		return true
	}
	return u.compareVersion(u.newVersionInfo.TagName, u.oldVersionInfo.TagName) != 0
}

func (u *Updater) getCurrentVersion() (versionInfo *VersionInfo, err error) {
	if err = checkExist(u.versionFile, ""); err != nil {
		return
	}
	fileContent, err := ioutil.ReadFile(u.versionFile)
	if err != nil {
		return
	}
	body := &VersionInfo{}
	if err = json.Unmarshal(fileContent, body); err != nil {
		return
	}
	return body, nil
}

func (u *Updater) getLatestVersion() (versionInfo *VersionInfo, err error) {
	client := u.newHTTPClient()
	resp, err := client.Get(u.url)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		err = fmt.Errorf("error status code: %d", resp.StatusCode)
		return
	}

	bodyContent, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return
	}

	versionInfo = &VersionInfo{}
	if err = json.Unmarshal(bodyContent, versionInfo); err != nil {
		return
	}
	return
}

// 1.2.16
func (u *Updater) compareVersion(v1, v2 string) (result int) {
	if v1 == "" && v2 != "" {
		return -1
	} else if v2 == "" && v1 != "" {
		return 1
	}

	v1Arr := strings.Split(v1, ".")
	v2Arr := strings.Split(v2, ".")
	len1 := len(v1Arr)
	len2 := len(v2Arr)

	for i := 0; i < len1 || i < len2; i++ {
		var n1, n2 int
		if i < len1 {
			n1, _ = strconv.Atoi(v1Arr[i])
		}
		if i < len2 {
			n2, _ = strconv.Atoi(v2Arr[i])
		}

		if n1 > n2 {
			return 1
		} else if n1 < n2 {
			return -1
		}
	}

	return 0
}

func (u *Updater) downloadLatestVersion() (err error) {
	client := u.newHTTPClient()
	resp, err := client.Get(u.newVersionInfo.ZipBallUrl)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		err = fmt.Errorf("error status code: %d", resp.StatusCode)
		return
	}

	out, err := os.Create(u.downloadFile)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, resp.Body)
	return
}

func (u *Updater) unzip() (err error) {
	extract := func(file *zip.File) error {
		zippedFile, err := file.Open()
		if err != nil {
			return err
		}
		defer zippedFile.Close()

		extractedFilePath := filepath.Join(u.unzipDir, file.Name)
		if file.FileInfo().IsDir() {
			fmt.Println("Creating directory:", extractedFilePath)
			return os.MkdirAll(extractedFilePath, file.Mode())
		}
		fmt.Println("Extracting file:", file.Name)
		outputFile, err := os.OpenFile(extractedFilePath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, file.Mode())
		if err != nil {
			return err
		}
		defer outputFile.Close()

		if _, err = io.Copy(outputFile, zippedFile); err != nil {
			return err
		}
		return nil
	}

	zipReader, err := zip.OpenReader(u.downloadFile)
	if err != nil {
		return err
	}
	defer zipReader.Close()

	for _, file := range zipReader.Reader.File {
		if err = extract(file); err != nil {
			return
		}
	}
	u.unzipDir = filepath.Join(u.unzipDir, zipReader.Reader.File[0].Name)
	return
}

func (u *Updater) adjustSettingFiles() (err error) {
	for _, settingFile := range u.userSettingFiles {
		filePath := filepath.Join(u.unzipDir, settingFile)
		if err = os.Remove(filePath); err != nil {
			return
		}
	}

	// ./plugin/updater/updater.exe -> ./plugin/updater/updater-1.2.13.exe
	// 为什么要遍历而不是直接修改：我怕以后可能会修改位置
	var updaterFilePath string
	pluginDir := filepath.Join(u.unzipDir, "./plugin")
	err = filepath.Walk(pluginDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && info.Name() == "updater.exe" {
			updaterFilePath = path
		}
		return nil
	})
	if updaterFilePath != "" {
		newFilePath := filepath.Join(filepath.Dir(updaterFilePath), fmt.Sprintf("updater%s.exe", u.newVersionInfo.TagName))
		return os.Rename(updaterFilePath, newFilePath)
	}
	return nil
}

func (u *Updater) syncDir() (err error) {
	src := filepath.Join(u.unzipDir, "./plugin")
	dst := filepath.Join(u.root, "./plugin")
	return copyDir(src, dst)
}

func (u *Updater) deleteUseless() (err error) {
	if err = os.Remove(u.downloadFile); err != nil {
		return
	}
	return os.RemoveAll(u.unzipDir)
}

func copyFile(src, dst string) (err error) {
	var srcFd *os.File
	var dstFd *os.File
	var srcInfo os.FileInfo

	if srcFd, err = os.Open(src); err != nil {
		return err
	}
	defer srcFd.Close()

	if dstFd, err = os.Create(dst); err != nil {
		return err
	}
	defer dstFd.Close()

	if _, err = io.Copy(dstFd, srcFd); err != nil {
		return err
	}
	if srcInfo, err = os.Stat(src); err != nil {
		return err
	}
	return os.Chmod(dst, srcInfo.Mode())
}

func copyDir(src string, dst string) (err error) {
	var fds []os.FileInfo
	var srcInfo os.FileInfo

	if srcInfo, err = os.Stat(src); err != nil {
		return err
	}
	if err = os.MkdirAll(dst, srcInfo.Mode()); err != nil {
		return err
	}
	if fds, err = ioutil.ReadDir(src); err != nil {
		return err
	}
	for _, fd := range fds {
		srcFilePath := filepath.Join(src, fd.Name())
		dstFilePath := filepath.Join(dst, fd.Name())

		if fd.IsDir() {
			if err = copyDir(srcFilePath, dstFilePath); err != nil {
				return err
			}
		} else {
			if err = copyFile(srcFilePath, dstFilePath); err != nil {
				return err
			}
		}
	}
	return nil
}

func checkExist(root, sub string) error {
	if sub != "" {
		root = filepath.Join(root, sub)
	}
	exist, err := pathExists(root)
	if !exist {
		err = fmt.Errorf("%s is not exist", root)
	}
	return err
}

func pathExists(path string) (bool, error) {
	_, err := os.Stat(path)
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, err
	}
	return false, err
}

func insert() (err error) {
	inserter, err := NewInserter()
	if err != nil {
		return err
	}
	if err = inserter.prepare(); err != nil {
		return err
	}
	if err = inserter.run(); err != nil {
		return err
	}
	return nil
}

func update() (err error) {
	updater, err := NewUpdater()
	if err != nil {
		return err
	}
	if err = updater.deleteResidualFile(); err != nil {
		return
	}
	if need := updater.needUpdate(); !need {
		return
	}
	if err = updater.downloadLatestVersion(); err != nil {
		return
	}
	if err = updater.unzip(); err != nil {
		return
	}
	if err = updater.adjustSettingFiles(); err != nil {
		return
	}
	if err = updater.syncDir(); err != nil {
		return
	}
	if err = updater.deleteUseless(); err != nil {
		return
	}
	return
}

func main() {
	//if err := insert(); err != nil {
	//	panic(err)
	//}

	if err := update(); err != nil {
		panic(err)
	}
}